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
