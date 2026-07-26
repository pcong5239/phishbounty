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
