# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

"""PhishBounty PhishReportCore"""

from genlayer import *

MIN_STAKE_ABS = 500_000_000_000_000
MIN_FIRST_DEPOSIT = 10_000_000_000_000_000
BOUNTY_MIN = 2_000_000_000_000_000
BOUNTY_MAX = 50_000_000_000_000_000
APPEAL_WINDOW = 600
REVERIFY_COOLDOWN = 1800
MAX_OPEN_PER_HUNTER = 5
MAX_URL_LEN = 300

STATUS_SUBMITTED = 1
STATUS_CONFIRMED = 2
STATUS_SUSPICIOUS = 3
STATUS_CLEARED = 4
STATUS_UNDETERMINED = 5
STATUS_APPEALED = 6
STATUS_FINAL_CONFIRMED = 7
STATUS_FINAL_CLEARED = 8
STATUS_WITHDRAWN = 9

VERDICT_NONE = 0
VERDICT_CONFIRMED_PHISHING = 1
VERDICT_SUSPICIOUS = 2
VERDICT_CLEARED = 3

SIGNAL_BRAND_NAME_MIMICRY = 1
SIGNAL_LOGO_OR_VISUAL_MIMICRY = 2
SIGNAL_LOOKALIKE_DOMAIN = 3
SIGNAL_CREDENTIAL_HARVEST_FORM = 4
SIGNAL_URGENCY_OR_SCARE_LANGUAGE = 5
SIGNAL_FAKE_SUPPORT_OR_WALLET_PROMPT = 6
SIGNAL_CLONED_LAYOUT = 7
SIGNAL_NONE_OBSERVED = 8


# Duplicated from brand_registry.py because Studio deploys single self-contained files.
def _normalize_domain(raw: str) -> str:
    """Normalize domain name or raise ValueError("ERR_DOMAIN_FORMAT")."""
    if not isinstance(raw, str):
        raise ValueError("ERR_DOMAIN_FORMAT")

    s = raw.strip().lower()
    if s.endswith("."):
        s = s[:-1]

    if not s:
        raise ValueError("ERR_DOMAIN_FORMAT")

    if "://" in raw or "/" in s or "?" in s or "#" in s or "@" in s or ":" in s:
        raise ValueError("ERR_DOMAIN_FORMAT")

    for ch in s:
        if ch.isspace():
            raise ValueError("ERR_DOMAIN_FORMAT")

    if len(s) > 253:
        raise ValueError("ERR_DOMAIN_FORMAT")

    if "[" in s or "]" in s:
        raise ValueError("ERR_DOMAIN_FORMAT")

    labels = s.split(".")
    if len(labels) < 2:
        raise ValueError("ERR_DOMAIN_FORMAT")

    if all(label.isdigit() for label in labels):
        raise ValueError("ERR_DOMAIN_FORMAT")

    if len(labels) == 4 and all(label.isdigit() for label in labels):
        if all(0 <= int(label) <= 255 for label in labels):
            raise ValueError("ERR_DOMAIN_FORMAT")

    for label in labels:
        if len(label) == 0 or len(label) > 63:
            raise ValueError("ERR_DOMAIN_FORMAT")
        if label.startswith("-") or label.endswith("-"):
            raise ValueError("ERR_DOMAIN_FORMAT")
        if not all(c in "abcdefghijklmnopqrstuvwxyz0123456789-" for c in label):
            raise ValueError("ERR_DOMAIN_FORMAT")

    return s


class Contract(gl.Contract):
    registry_addr: Address
    blocklist_addr: Address
    pool_balance: TreeMap[u256, u256]
    pool_reserved: TreeMap[u256, u256]
    pool_bounty: TreeMap[u256, u256]
    report_count: u256
    report_brand: TreeMap[u256, u256]
    report_hunter: TreeMap[u256, Address]
    report_url: TreeMap[u256, str]
    report_domain: TreeMap[u256, str]
    report_stake: TreeMap[u256, u256]
    report_bounty: TreeMap[u256, u256]
    report_status: TreeMap[u256, u8]
    report_verdict: TreeMap[u256, u8]
    report_confidence: TreeMap[u256, u8]
    report_signals: TreeMap[u256, DynArray[u8]]
    report_reason: TreeMap[u256, str]
    report_submitted_at: TreeMap[u256, u64]
    report_adjudicated_at: TreeMap[u256, u64]
    report_appeal_deadline: TreeMap[u256, u64]
    report_appellant: TreeMap[u256, Address]
    report_appeal_stake: TreeMap[u256, u256]
    report_retry: TreeMap[u256, u8]
    pending_domain: TreeMap[str, u256]
    confirmed_domain: TreeMap[str, u256]
    hunter_open_count: TreeMap[Address, u256]
    hunter_confirmed_count: TreeMap[Address, u256]
    hunter_cleared_count: TreeMap[Address, u256]
    hunter_suspicious_count: TreeMap[Address, u256]

    def __init__(self, registry_addr: Address, blocklist_addr: Address):
        self.registry_addr = Address(registry_addr)
        self.blocklist_addr = Address(blocklist_addr)
        self.report_count = 0

    def _sender(self) -> Address:
        return gl.message.sender  # VERIFY-AT-STUDIO

    def _value(self) -> int:
        return gl.message.value  # VERIFY-AT-STUDIO

    def _now(self) -> int:
        return gl.block.timestamp  # VERIFY-AT-STUDIO

    def _registry(self):
        return gl.get_contract_at(self.registry_addr)  # VERIFY-AT-STUDIO

    def _blocklist_state(self, domain: str) -> int:
        blocklist = gl.get_contract_at(self.blocklist_addr)  # VERIFY-AT-STUDIO
        return blocklist.get_domain_state(domain)  # VERIFY-AT-STUDIO

    @gl.public.write
    def fund_pool(self, brand_id: u256) -> None:
        brand_info = self._registry().get_brand(brand_id)
        if not brand_info["active"]:
            raise ValueError("ERR_BRAND_INACTIVE")

        val = self._value()
        if val <= 0:
            raise ValueError("ERR_ZERO_VALUE")

        curr_bal = self.pool_balance.get(brand_id, 0)
        if curr_bal == 0 and val < MIN_FIRST_DEPOSIT:
            raise ValueError("ERR_MIN_DEPOSIT")

        self.pool_balance[brand_id] = curr_bal + val

    @gl.public.write
    def set_bounty(self, brand_id: u256, amount: u256) -> None:
        brand_info = self._registry().get_brand(brand_id)
        if self._sender() != Address(brand_info["admin"]):
            raise ValueError("ERR_NOT_ADMIN")

        if not (BOUNTY_MIN <= amount <= BOUNTY_MAX):
            raise ValueError("ERR_BOUNTY_RANGE")

        self.pool_bounty[brand_id] = amount

    @gl.public.view
    def get_required_stake(self, brand_id: u256) -> u256:
        bounty = self.pool_bounty.get(brand_id, 0)
        if bounty == 0:
            raise ValueError("ERR_NO_BOUNTY")
        return max(bounty // 5, MIN_STAKE_ABS)

    @gl.public.view
    def get_pool(self, brand_id: u256) -> dict:
        bal = self.pool_balance.get(brand_id, 0)
        res = self.pool_reserved.get(brand_id, 0)
        bounty = self.pool_bounty.get(brand_id, 0)
        req_stake = max(bounty // 5, MIN_STAKE_ABS) if bounty > 0 else 0
        return {
            "balance": bal,
            "reserved": res,
            "bounty_amount": bounty,
            "required_stake": req_stake,
        }

    @gl.public.write
    def submit_report(self, brand_id: u256, suspect_url: str) -> u256:
        # Guard 1: URL length & scheme
        if len(suspect_url) > MAX_URL_LEN:
            raise ValueError("ERR_URL_LENGTH")

        if suspect_url.startswith("http://"):
            rest = suspect_url[7:]
        elif suspect_url.startswith("https://"):
            rest = suspect_url[8:]
        else:
            raise ValueError("ERR_URL_SCHEME")

        # Guard 2: Extract hostname & normalize
        host_segment = rest.split("/")[0].split("?")[0].split("#")[0]
        if "@" in host_segment:
            raise ValueError("ERR_DOMAIN_FORMAT")

        host = host_segment.split(":")[0]
        norm_domain = _normalize_domain(host)

        # Guard 3: Registry checks
        if self._registry().is_official_domain(norm_domain):
            raise ValueError("ERR_OFFICIAL_DOMAIN")

        brand_info = self._registry().get_brand(brand_id)
        if not brand_info["active"]:
            raise ValueError("ERR_BRAND_INACTIVE")

        if self._sender() == Address(brand_info["admin"]):
            raise ValueError("ERR_SELF_REPORT")

        # Guard 4: Pool checks
        bounty = self.pool_bounty.get(brand_id, 0)
        if bounty == 0:
            raise ValueError("ERR_NO_BOUNTY")

        bal = self.pool_balance.get(brand_id, 0)
        res = self.pool_reserved.get(brand_id, 0)
        if bal - res < bounty:
            raise ValueError("ERR_POOL_INSUFFICIENT")

        # Guard 5: Domain checks
        if self.pending_domain.get(norm_domain, 0) != 0:
            raise ValueError("ERR_DUPLICATE_PENDING")

        if self.confirmed_domain.get(norm_domain, 0) != 0:
            if self._blocklist_state(norm_domain) != 2:
                raise ValueError("ERR_ALREADY_CONFIRMED")

        # Guard 6: Hunter checks
        open_count = self.hunter_open_count.get(self._sender(), 0)
        if open_count >= MAX_OPEN_PER_HUNTER:
            raise ValueError("ERR_OPEN_CAP")

        req_stake = self.get_required_stake(brand_id)
        if self._value() != req_stake:
            raise ValueError("ERR_STAKE_AMOUNT")

        # Persistence & Effects
        self.report_count += 1
        rid = self.report_count

        self.report_brand[rid] = brand_id
        self.report_hunter[rid] = self._sender()
        self.report_url[rid] = suspect_url
        self.report_domain[rid] = norm_domain
        self.report_stake[rid] = self._value()
        self.report_bounty[rid] = bounty
        self.report_status[rid] = STATUS_SUBMITTED
        self.report_verdict[rid] = VERDICT_NONE
        self.report_confidence[rid] = 0
        self.report_signals[rid] = DynArray()
        self.report_reason[rid] = ""
        self.report_submitted_at[rid] = self._now()
        self.report_adjudicated_at[rid] = 0
        self.report_appeal_deadline[rid] = 0
        self.report_appellant[rid] = Address("0x0000000000000000000000000000000000000000")
        self.report_appeal_stake[rid] = 0
        self.report_retry[rid] = 0

        self.pool_reserved[brand_id] = res + bounty
        self.pending_domain[norm_domain] = rid
        self.hunter_open_count[self._sender()] = open_count + 1

        return rid

    @gl.public.write
    def adjudicate(self, report_id: u256) -> None:
        if report_id not in self.report_brand:
            raise ValueError("ERR_NOT_FOUND")
        if self.report_status[report_id] != STATUS_SUBMITTED:
            raise ValueError("ERR_NOT_SUBMITTED")
        raise NotImplementedError("ERR_PHASE3")

    @gl.public.view
    def get_report(self, report_id: u256) -> dict:
        if report_id not in self.report_brand:
            raise ValueError("ERR_NOT_FOUND")

        return {
            "id": report_id,
            "brand_id": self.report_brand[report_id],
            "hunter": str(self.report_hunter[report_id]),
            "suspect_url": self.report_url[report_id],
            "suspect_domain": self.report_domain[report_id],
            "stake": self.report_stake[report_id],
            "bounty": self.report_bounty[report_id],
            "status": self.report_status[report_id],
            "verdict": self.report_verdict[report_id],
            "confidence": self.report_confidence[report_id],
            "signals": list(self.report_signals[report_id]),
            "reason": self.report_reason[report_id],
            "submitted_at": self.report_submitted_at[report_id],
            "adjudicated_at": self.report_adjudicated_at[report_id],
            "appeal_deadline": self.report_appeal_deadline[report_id],
            "appellant": str(self.report_appellant[report_id]),
            "appeal_stake": self.report_appeal_stake[report_id],
            "retry_count": self.report_retry[report_id],
        }

    @gl.public.view
    def get_report_count(self) -> u256:
        return self.report_count

    @gl.public.view
    def get_hunter_stats(self, addr: Address) -> dict:
        a = Address(addr)
        return {
            "open": self.hunter_open_count.get(a, 0),
            "confirmed": self.hunter_confirmed_count.get(a, 0),
            "cleared": self.hunter_cleared_count.get(a, 0),
            "suspicious": self.hunter_suspicious_count.get(a, 0),
        }
