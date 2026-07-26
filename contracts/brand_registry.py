# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

"""PhishBounty BrandRegistry"""

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
    brand_count: u256
    brand_name: TreeMap[u256, str]
    brand_admin: TreeMap[u256, Address]
    brand_domains: TreeMap[u256, DynArray[str]]
    brand_scope: TreeMap[u256, str]
    brand_active: TreeMap[u256, bool]
    brand_created_at: TreeMap[u256, u64]
    domain_to_brand: TreeMap[str, u256]

    def __init__(self):
        self.brand_count = 0

    @gl.public.write
    def register_brand(self, name: str, domains_csv: str, scope_note: str) -> u256:
        s_name = name.strip()
        if not (2 <= len(s_name) <= 64):
            raise ValueError("ERR_NAME_LENGTH")

        if len(scope_note) > 500:
            raise ValueError("ERR_SCOPE_LENGTH")

        if not isinstance(domains_csv, str):
            raise ValueError("ERR_DOMAIN_COUNT")

        raw_entries = [d.strip() for d in domains_csv.split(",") if d.strip()]
        if not (1 <= len(raw_entries) <= 5):
            raise ValueError("ERR_DOMAIN_COUNT")

        norm_domains = []
        seen = set()
        for raw_entry in raw_entries:
            norm_dom = _normalize_domain(raw_entry)
            if norm_dom in seen or norm_dom in self.domain_to_brand:
                raise ValueError("ERR_DOMAIN_TAKEN")
            seen.add(norm_dom)
            norm_domains.append(norm_dom)

        self.brand_count += 1
        brand_id = self.brand_count

        self.brand_name[brand_id] = s_name
        self.brand_admin[brand_id] = gl.message.sender
        self.brand_domains[brand_id] = DynArray(norm_domains)
        self.brand_scope[brand_id] = scope_note
        self.brand_active[brand_id] = True
        # TODO: Wire block timestamp in Phase 3 when gl.message context is finalized
        self.brand_created_at[brand_id] = 0

        for dom in norm_domains:
            self.domain_to_brand[dom] = brand_id

        return brand_id

    @gl.public.write
    def update_scope(self, brand_id: u256, scope_note: str) -> None:
        if brand_id not in self.brand_name:
            raise ValueError("ERR_NOT_FOUND")
        if gl.message.sender != self.brand_admin[brand_id]:
            raise ValueError("ERR_NOT_ADMIN")
        if len(scope_note) > 500:
            raise ValueError("ERR_SCOPE_LENGTH")

        self.brand_scope[brand_id] = scope_note

    @gl.public.write
    def set_active(self, brand_id: u256, active: bool) -> None:
        if brand_id not in self.brand_name:
            raise ValueError("ERR_NOT_FOUND")
        if gl.message.sender != self.brand_admin[brand_id]:
            raise ValueError("ERR_NOT_ADMIN")

        self.brand_active[brand_id] = active

    @gl.public.view
    def get_brand(self, brand_id: u256) -> dict:
        if brand_id not in self.brand_name:
            raise ValueError("ERR_NOT_FOUND")

        return {
            "id": brand_id,
            "name": self.brand_name[brand_id],
            "admin": str(self.brand_admin[brand_id]),
            "domains": list(self.brand_domains[brand_id]),
            "scope_note": self.brand_scope[brand_id],
            "active": self.brand_active[brand_id],
            "created_at": self.brand_created_at[brand_id],
        }

    @gl.public.view
    def get_brand_count(self) -> u256:
        return self.brand_count

    @gl.public.view
    def is_official_domain(self, domain: str) -> bool:
        try:
            norm_dom = _normalize_domain(domain)
        except ValueError:
            return False
        return norm_dom in self.domain_to_brand

    @gl.public.view
    def get_brand_id_by_domain(self, domain: str) -> u256:
        try:
            norm_dom = _normalize_domain(domain)
        except ValueError:
            return 0
        return self.domain_to_brand.get(norm_dom, 0)
