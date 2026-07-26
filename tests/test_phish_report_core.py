import pytest
from genlayer import Address, gl
from phish_report_core import (
    BOUNTY_MAX,
    BOUNTY_MIN,
    MIN_FIRST_DEPOSIT,
    MIN_STAKE_ABS,
)


def test_fund_pool(system):
    # Register brand with admin caller
    system.set_caller(system.admin)
    brand_id = system.registry.register_brand("Brand Acme", "acme.com", "Scope")

    # Zero value rejected
    system.set_caller(system.admin, value=0)
    with pytest.raises(ValueError, match="ERR_ZERO_VALUE"):
        system.core.fund_pool(brand_id)

    # First deposit below min rejected
    system.set_caller(system.admin, value=MIN_FIRST_DEPOSIT - 1)
    with pytest.raises(ValueError, match="ERR_MIN_DEPOSIT"):
        system.core.fund_pool(brand_id)

    # First deposit happy path
    system.set_caller(system.admin, value=MIN_FIRST_DEPOSIT)
    system.core.fund_pool(brand_id)
    assert system.core.get_pool(brand_id)["balance"] == MIN_FIRST_DEPOSIT

    # Top-up below min allowed after first deposit
    system.set_caller(system.admin, value=1_000)
    system.core.fund_pool(brand_id)
    assert system.core.get_pool(brand_id)["balance"] == MIN_FIRST_DEPOSIT + 1_000


def test_brand_inactive_or_unknown(system):
    system.set_caller(system.admin)
    brand_id = system.registry.register_brand("Brand Acme", "acme.com", "Scope")

    # Unknown brand -> ERR_NOT_FOUND
    system.set_caller(system.admin, value=MIN_FIRST_DEPOSIT)
    with pytest.raises(ValueError, match="ERR_NOT_FOUND"):
        system.core.fund_pool(999)

    # Inactive brand -> ERR_BRAND_INACTIVE
    system.registry.set_active(brand_id, False)
    with pytest.raises(ValueError, match="ERR_BRAND_INACTIVE"):
        system.core.fund_pool(brand_id)


def test_set_bounty(system):
    system.set_caller(system.admin)
    brand_id = system.registry.register_brand("Brand Acme", "acme.com", "Scope")

    # Non-admin -> ERR_NOT_ADMIN
    system.set_caller(system.hunter)
    with pytest.raises(ValueError, match="ERR_NOT_ADMIN"):
        system.core.set_bounty(brand_id, BOUNTY_MIN)

    # Out of range below BOUNTY_MIN -> ERR_BOUNTY_RANGE
    system.set_caller(system.admin)
    with pytest.raises(ValueError, match="ERR_BOUNTY_RANGE"):
        system.core.set_bounty(brand_id, BOUNTY_MIN - 1)

    # Out of range above BOUNTY_MAX -> ERR_BOUNTY_RANGE
    with pytest.raises(ValueError, match="ERR_BOUNTY_RANGE"):
        system.core.set_bounty(brand_id, BOUNTY_MAX + 1)

    # Happy path
    system.core.set_bounty(brand_id, BOUNTY_MIN)
    assert system.core.get_pool(brand_id)["bounty_amount"] == BOUNTY_MIN


def test_get_required_stake(system):
    system.set_caller(system.admin)
    brand_id = system.registry.register_brand("Brand Acme", "acme.com", "Scope")

    # Unconfigured -> ERR_NO_BOUNTY
    with pytest.raises(ValueError, match="ERR_NO_BOUNTY"):
        system.core.get_required_stake(brand_id)

    # Bounty set to BOUNTY_MIN (0.002 GEN) -> bounty // 5 = 0.0004 GEN < MIN_STAKE_ABS (0.0005 GEN) -> floor at MIN_STAKE_ABS
    system.core.set_bounty(brand_id, BOUNTY_MIN)
    assert system.core.get_required_stake(brand_id) == MIN_STAKE_ABS

    # Larger bounty -> BOUNTY_MAX (0.05 GEN) -> bounty // 5 = 0.01 GEN > MIN_STAKE_ABS
    system.core.set_bounty(brand_id, BOUNTY_MAX)
    assert system.core.get_required_stake(brand_id) == BOUNTY_MAX // 5


def test_submit_report_happy_path_and_views(system):
    system.set_caller(system.admin)
    brand_id = system.registry.register_brand("Brand Acme", "acme.com", "Scope")

    # Fund pool and set bounty
    system.set_caller(system.admin, value=MIN_FIRST_DEPOSIT)
    system.core.fund_pool(brand_id)
    system.set_caller(system.admin)
    bounty = 10_000_000_000_000_000  # 0.01 GEN
    system.core.set_bounty(brand_id, bounty)
    stake = system.core.get_required_stake(brand_id)

    # Hunter submits report
    system.set_caller(system.hunter, value=stake)
    gl.set_time(1_234_567)
    rid = system.core.submit_report(brand_id, "https://phish-acme.com/login")
    assert rid == 1

    # Assert stored report fields
    rep = system.core.get_report(rid)
    assert rep["id"] == 1
    assert rep["brand_id"] == brand_id
    assert rep["hunter"] == str(system.hunter)
    assert rep["suspect_url"] == "https://phish-acme.com/login"
    assert rep["suspect_domain"] == "phish-acme.com"
    assert rep["stake"] == stake
    assert rep["bounty"] == bounty
    assert rep["status"] == 1  # SUBMITTED
    assert rep["submitted_at"] == 1_234_567

    # Assert pool reserved and hunter stats
    pool = system.core.get_pool(brand_id)
    assert pool["reserved"] == bounty

    h_stats = system.core.get_hunter_stats(system.hunter)
    assert h_stats["open"] == 1
    assert system.core.get_report_count() == 1


def test_submit_report_guard_chain(system):
    system.set_caller(system.admin)
    brand_id = system.registry.register_brand("Brand Acme", "acme.com", "Scope")
    system.set_caller(system.admin, value=MIN_FIRST_DEPOSIT)
    system.core.fund_pool(brand_id)
    system.set_caller(system.admin)
    bounty = 10_000_000_000_000_000
    system.core.set_bounty(brand_id, bounty)
    stake = system.core.get_required_stake(brand_id)

    # 1. URL length 301 -> ERR_URL_LENGTH
    system.set_caller(system.hunter, value=stake)
    long_url = "https://phish-acme.com/" + ("a" * 300)
    with pytest.raises(ValueError, match="ERR_URL_LENGTH"):
        system.core.submit_report(brand_id, long_url)

    # 2. Bad scheme -> ERR_URL_SCHEME
    with pytest.raises(ValueError, match="ERR_URL_SCHEME"):
        system.core.submit_report(brand_id, "ftp://phish-acme.com")

    # 3. URL with credentials -> ERR_DOMAIN_FORMAT
    with pytest.raises(ValueError, match="ERR_DOMAIN_FORMAT"):
        system.core.submit_report(brand_id, "https://user:pass@phish-acme.com")

    # 4. IP host -> ERR_DOMAIN_FORMAT
    with pytest.raises(ValueError, match="ERR_DOMAIN_FORMAT"):
        system.core.submit_report(brand_id, "https://192.168.1.1/login")

    # 5. Single label host -> ERR_DOMAIN_FORMAT
    with pytest.raises(ValueError, match="ERR_DOMAIN_FORMAT"):
        system.core.submit_report(brand_id, "https://localhost/login")

    # 6. Official domain -> ERR_OFFICIAL_DOMAIN
    with pytest.raises(ValueError, match="ERR_OFFICIAL_DOMAIN"):
        system.core.submit_report(brand_id, "https://acme.com/phish")

    # 7. Self report -> ERR_SELF_REPORT
    system.set_caller(system.admin, value=stake)
    with pytest.raises(ValueError, match="ERR_SELF_REPORT"):
        system.core.submit_report(brand_id, "https://phish-acme.com")

    # 8. No bounty configured (on brand 2)
    system.set_caller(system.admin)
    b2 = system.registry.register_brand("Brand 2", "brand2.com", "Scope")
    system.set_caller(system.hunter, value=stake)
    with pytest.raises(ValueError, match="ERR_NO_BOUNTY"):
        system.core.submit_report(b2, "https://phish-brand2.com")

    # 9. Pool insufficient (balance ok, but reserved makes it insufficient)
    # Pool balance = MIN_FIRST_DEPOSIT (0.01 GEN), bounty = 0.01 GEN.
    # First report reserves 0.01 GEN, remaining unreserved = 0.
    system.set_caller(system.hunter, value=stake)
    system.core.submit_report(brand_id, "https://phish1-acme.com")

    with pytest.raises(ValueError, match="ERR_POOL_INSUFFICIENT"):
        system.core.submit_report(brand_id, "https://phish2-acme.com")

    # Top up pool to allow more reports
    system.set_caller(system.admin, value=MIN_FIRST_DEPOSIT * 10)
    system.core.fund_pool(brand_id)

    # 10. Duplicate pending -> ERR_DUPLICATE_PENDING
    system.set_caller(system.hunter, value=stake)
    with pytest.raises(ValueError, match="ERR_DUPLICATE_PENDING"):
        system.core.submit_report(brand_id, "https://phish1-acme.com/other-page")

    # 11. Already confirmed & blocked -> ERR_ALREADY_CONFIRMED
    # Manually simulate confirmed domain in confirmed_domain map
    system.core.confirmed_domain["confirmed-phish.com"] = 99
    # Append event to blocklist as LISTED (state 1) by writer (core)
    system.set_caller(system.core_addr)
    system.blocklist.append_event("confirmed-phish.com", 1, 99, system.hunter)

    system.set_caller(system.hunter, value=stake)
    with pytest.raises(ValueError, match="ERR_ALREADY_CONFIRMED"):
        system.core.submit_report(brand_id, "https://confirmed-phish.com")

    # 12. Resubmit allowed when blocklist state NEUTRALIZED (state 2)
    system.set_caller(system.core_addr)
    system.blocklist.append_event("confirmed-phish.com", 2, 99, system.hunter)  # NEUTRALIZED

    system.set_caller(system.hunter, value=stake)
    rid = system.core.submit_report(brand_id, "https://confirmed-phish.com")
    assert rid > 0

    # 13. Open cap at 5 -> ERR_OPEN_CAP
    # Current open count for system.hunter is 2 (phish1-acme.com and confirmed-phish.com). Submit 3 more.
    system.core.submit_report(brand_id, "https://open3.com")
    system.core.submit_report(brand_id, "https://open4.com")
    system.core.submit_report(brand_id, "https://open5.com")
    assert system.core.get_hunter_stats(system.hunter)["open"] == 5

    with pytest.raises(ValueError, match="ERR_OPEN_CAP"):
        system.core.submit_report(brand_id, "https://open6.com")

    # 14. Wrong stake (too low & too high) -> ERR_STAKE_AMOUNT
    h2 = "0x7777777777777777777777777777777777777777"
    system.set_caller(h2, value=stake - 1)
    with pytest.raises(ValueError, match="ERR_STAKE_AMOUNT"):
        system.core.submit_report(brand_id, "https://phish-stake-check.com")

    system.set_caller(h2, value=stake + 1)
    with pytest.raises(ValueError, match="ERR_STAKE_AMOUNT"):
        system.core.submit_report(brand_id, "https://phish-stake-check.com")


def test_port_handling(system):
    # Port handling: "https://evil-example.com:8443/login" must submit successfully with domain "evil-example.com"
    system.set_caller(system.admin)
    brand_id = system.registry.register_brand("Brand Acme", "acme.com", "Scope")
    system.set_caller(system.admin, value=MIN_FIRST_DEPOSIT)
    system.core.fund_pool(brand_id)
    system.set_caller(system.admin)
    system.core.set_bounty(brand_id, BOUNTY_MIN)
    stake = system.core.get_required_stake(brand_id)

    system.set_caller(system.hunter, value=stake)
    rid = system.core.submit_report(brand_id, "https://evil-example.com:8443/login")
    rep = system.core.get_report(rid)
    assert rep["suspect_domain"] == "evil-example.com"


def test_adjudicate_stub(system):
    system.set_caller(system.admin)
    brand_id = system.registry.register_brand("Brand Acme", "acme.com", "Scope")
    system.set_caller(system.admin, value=MIN_FIRST_DEPOSIT)
    system.core.fund_pool(brand_id)
    system.set_caller(system.admin)
    system.core.set_bounty(brand_id, BOUNTY_MIN)
    stake = system.core.get_required_stake(brand_id)

    system.set_caller(system.hunter, value=stake)
    rid = system.core.submit_report(brand_id, "https://evil-acme.com")

    # Unknown report -> ERR_NOT_FOUND
    with pytest.raises(ValueError, match="ERR_NOT_FOUND"):
        system.core.adjudicate(999)

    # Valid report -> raises NotImplementedError("ERR_PHASE3")
    with pytest.raises(NotImplementedError, match="ERR_PHASE3"):
        system.core.adjudicate(rid)

    # Non-SUBMITTED status -> ERR_NOT_SUBMITTED
    system.core.report_status[rid] = 2  # CONFIRMED
    with pytest.raises(ValueError, match="ERR_NOT_SUBMITTED"):
        system.core.adjudicate(rid)
