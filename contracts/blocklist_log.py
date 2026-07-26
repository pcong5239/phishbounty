# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

"""PhishBounty BlocklistLog"""

from genlayer import *


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
    owner: Address
    writer: Address
    writer_set: bool
    event_count: u256
    event_domain: TreeMap[u256, str]
    event_kind: TreeMap[u256, u8]
    event_report_id: TreeMap[u256, u256]
    event_hunter: TreeMap[u256, Address]
    event_at: TreeMap[u256, u64]
    domain_event_ids: TreeMap[str, DynArray[u256]]
    domain_state: TreeMap[str, u8]
    hunter_confirmed: TreeMap[Address, u256]

    def __init__(self):
        self.owner = gl.message.sender  # VERIFY-AT-STUDIO
        self.writer = Address("0x0000000000000000000000000000000000000000")
        self.writer_set = False
        self.event_count = 0

    @gl.public.write
    def set_writer(self, writer: Address) -> None:
        if gl.message.sender != self.owner:  # VERIFY-AT-STUDIO
            raise ValueError("ERR_NOT_OWNER")
        if self.writer_set:
            raise ValueError("ERR_WRITER_SET")
        self.writer = Address(writer)
        self.writer_set = True

    @gl.public.write
    def append_event(self, domain: str, kind: u8, report_id: u256, hunter: Address) -> None:
        if gl.message.sender != self.writer:  # VERIFY-AT-STUDIO
            raise ValueError("ERR_NOT_WRITER")
        if kind not in (1, 2, 3):
            raise ValueError("ERR_KIND")

        try:
            norm = _normalize_domain(domain)
            if norm != domain:
                raise ValueError("ERR_DOMAIN_FORMAT")
        except ValueError:
            raise ValueError("ERR_DOMAIN_FORMAT")

        curr_state = self.domain_state.get(domain, 0)
        if kind == 1 and curr_state != 0:
            raise ValueError("ERR_STATE")
        if kind == 2 and curr_state != 1:
            raise ValueError("ERR_STATE")
        if kind == 3 and curr_state != 2:
            raise ValueError("ERR_STATE")

        self.event_count += 1
        eid = self.event_count
        h_addr = Address(hunter)

        self.event_domain[eid] = domain
        self.event_kind[eid] = kind
        self.event_report_id[eid] = report_id
        self.event_hunter[eid] = h_addr
        self.event_at[eid] = gl.block.timestamp  # VERIFY-AT-STUDIO

        if domain not in self.domain_event_ids:
            self.domain_event_ids[domain] = DynArray()
        self.domain_event_ids[domain].append(eid)

        if kind in (1, 3):
            self.domain_state[domain] = 1
            self.hunter_confirmed[h_addr] = self.hunter_confirmed.get(h_addr, 0) + 1
        elif kind == 2:
            self.domain_state[domain] = 2

    @gl.public.view
    def is_blocked(self, domain: str) -> bool:
        return self.get_domain_state(domain) == 1

    @gl.public.view
    def get_domain_state(self, domain: str) -> u8:
        try:
            norm = _normalize_domain(domain)
            if norm != domain:
                return 0
        except ValueError:
            return 0
        return self.domain_state.get(domain, 0)

    @gl.public.view
    def get_domain_history(self, domain: str) -> list[dict]:
        try:
            norm = _normalize_domain(domain)
            if norm != domain:
                return []
        except ValueError:
            return []

        eids = self.domain_event_ids.get(domain, [])
        res = []
        for eid in eids:
            res.append({
                "id": eid,
                "kind": self.event_kind[eid],
                "report_id": self.event_report_id[eid],
                "hunter": str(self.event_hunter[eid]),
                "at": self.event_at[eid],
            })
        return res

    @gl.public.view
    def get_recent_events(self, n: u256) -> list[dict]:
        limit = min(n, 50)
        total = self.event_count
        start = max(1, total - limit + 1)
        res = []
        for eid in range(total, start - 1, -1):
            res.append({
                "id": eid,
                "kind": self.event_kind[eid],
                "report_id": self.event_report_id[eid],
                "hunter": str(self.event_hunter[eid]),
                "at": self.event_at[eid],
                "domain": self.event_domain[eid],
            })
        return res

    @gl.public.view
    def get_event_count(self) -> u256:
        return self.event_count

    @gl.public.view
    def get_hunter_confirmed(self, addr: Address) -> u256:
        return self.hunter_confirmed.get(Address(addr), 0)

    @gl.public.view
    def get_writer(self) -> str:
        return str(self.writer)
