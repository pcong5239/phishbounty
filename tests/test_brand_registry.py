import pytest


def test_register_happy_path(registry):
    # 1. register happy path: returns id 1 then 2; get_brand round-trips all fields; admin = caller
    registry.set_caller("0x1111111111111111111111111111111111111111")

    id1 = registry.register_brand("Brand One", "example.com, sub.example.com", "Scope 1")
    assert id1 == 1

    b1 = registry.get_brand(1)
    assert b1["id"] == 1
    assert b1["name"] == "Brand One"
    assert b1["admin"] == "0x1111111111111111111111111111111111111111"
    assert b1["domains"] == ["example.com", "sub.example.com"]
    assert b1["scope_note"] == "Scope 1"
    assert b1["active"] is True
    assert b1["created_at"] == 0

    registry.set_caller("0x2222222222222222222222222222222222222222")
    id2 = registry.register_brand("Brand Two", "other.com", "Scope 2")
    assert id2 == 2

    b2 = registry.get_brand(2)
    assert b2["id"] == 2
    assert b2["admin"] == "0x2222222222222222222222222222222222222222"
    assert registry.get_brand_count() == 2


def test_name_length_guards(registry):
    # 2. name too short (1 char) and too long (65) -> ERR_NAME_LENGTH
    with pytest.raises(ValueError, match="ERR_NAME_LENGTH"):
        registry.register_brand("A", "example.com", "Scope")

    with pytest.raises(ValueError, match="ERR_NAME_LENGTH"):
        registry.register_brand("A" * 65, "example.com", "Scope")


def test_scope_length_guards(registry):
    # 3. scope_note 501 chars -> ERR_SCOPE_LENGTH; update_scope same guard
    long_scope = "S" * 501
    with pytest.raises(ValueError, match="ERR_SCOPE_LENGTH"):
        registry.register_brand("Valid Brand", "example.com", long_scope)

    brand_id = registry.register_brand("Valid Brand", "example.com", "Scope")
    with pytest.raises(ValueError, match="ERR_SCOPE_LENGTH"):
        registry.update_scope(brand_id, long_scope)


def test_domains_csv_entry_count_and_duplicates(registry):
    # 4. domains_csv: 0 entries and 6 entries -> ERR_DOMAIN_COUNT; duplicate within list -> rejected
    with pytest.raises(ValueError, match="ERR_DOMAIN_COUNT"):
        registry.register_brand("Brand Zero", "", "Scope")

    six_domains = "d1.com, d2.com, d3.com, d4.com, d5.com, d6.com"
    with pytest.raises(ValueError, match="ERR_DOMAIN_COUNT"):
        registry.register_brand("Brand Six", six_domains, "Scope")

    with pytest.raises(ValueError, match="ERR_DOMAIN_TAKEN"):
        registry.register_brand("Brand Dup", "example.com, EXAMPLE.com", "Scope")


def test_domain_normalization(registry):
    # 5. normalization: " WWW.Example.COM. " registers as "www.example.com"; is_official_domain("www.EXAMPLE.com") is True
    id1 = registry.register_brand("Norm Brand", " WWW.Example.COM. ", "Scope")
    b = registry.get_brand(id1)
    assert b["domains"] == ["www.example.com"]
    assert registry.is_official_domain("www.EXAMPLE.com") is True
    assert registry.get_brand_id_by_domain("WWW.EXAMPLE.COM.") == id1


def test_domain_format_rejects(registry):
    # 6. format rejects: "https://x.com", "x.com/path", "user@x.com", "x.com:443", "192.168.0.1", "[::1]", "com", "-bad.com", "a..b.com" -> ERR_DOMAIN_FORMAT
    bad_domains = [
        "https://x.com",
        "x.com/path",
        "user@x.com",
        "x.com:443",
        "192.168.0.1",
        "[::1]",
        "com",
        "-bad.com",
        "a..b.com",
    ]

    for bad in bad_domains:
        with pytest.raises(ValueError, match="ERR_DOMAIN_FORMAT"):
            registry.register_brand(f"Brand {bad}", bad, "Scope")


def test_global_uniqueness(registry):
    # 7. global uniqueness: second brand registering an already-taken domain -> ERR_DOMAIN_TAKEN
    registry.register_brand("Brand 1", "unique.com", "Scope")
    with pytest.raises(ValueError, match="ERR_DOMAIN_TAKEN"):
        registry.register_brand("Brand 2", "unique.com", "Scope")


def test_admin_and_not_found_guards(registry):
    # 8. update_scope / set_active by non-admin -> ERR_NOT_ADMIN; unknown brand_id -> ERR_NOT_FOUND
    registry.set_caller("0x1111111111111111111111111111111111111111")
    brand_id = registry.register_brand("Brand 1", "b1.com", "Scope 1")

    registry.set_caller("0x9999999999999999999999999999999999999999")
    with pytest.raises(ValueError, match="ERR_NOT_ADMIN"):
        registry.update_scope(brand_id, "New Scope")

    with pytest.raises(ValueError, match="ERR_NOT_ADMIN"):
        registry.set_active(brand_id, False)

    with pytest.raises(ValueError, match="ERR_NOT_FOUND"):
        registry.update_scope(999, "Scope")

    with pytest.raises(ValueError, match="ERR_NOT_FOUND"):
        registry.set_active(999, False)

    with pytest.raises(ValueError, match="ERR_NOT_FOUND"):
        registry.get_brand(999)


def test_set_active(registry):
    # 9. set_active(False) then get_brand shows active False
    brand_id = registry.register_brand("Active Brand", "active.com", "Scope")
    assert registry.get_brand(brand_id)["active"] is True

    registry.set_active(brand_id, False)
    assert registry.get_brand(brand_id)["active"] is False


def test_views_malformed_input(registry):
    # 10. is_official_domain / get_brand_id_by_domain with malformed input return False / 0 without raising
    registry.register_brand("Valid Brand", "valid.com", "Scope")

    assert registry.is_official_domain("https://invalid.com") is False
    assert registry.is_official_domain("not-a-domain") is False
    assert registry.get_brand_id_by_domain("https://invalid.com") == 0
    assert registry.get_brand_id_by_domain("not-a-domain") == 0
