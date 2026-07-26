import pytest
from genlayer import gl
from phish_report_core import (
    APPEAL_WINDOW,
    BOUNTY_STEP,
    GEN,
    MIN_FIRST_DEPOSIT,
    MIN_STAKE_ABS,
    STATUS_FINAL_CONFIRMED,
)


def _register_brand(system) -> int:
    system.set_caller(system.admin)
    return system.registry.register_brand("Brand Acme", "acme.com", "Scope")


def test_bounty_step_rejects_seven_gen_and_accepts_supported_steps(system):
    brand_id = _register_brand(system)

    with pytest.raises(ValueError, match="ERR_BOUNTY_STEP"):
        system.core.set_bounty(brand_id, 7 * GEN)

    system.core.set_bounty(brand_id, 5 * GEN)
    assert system.core.get_pool(brand_id)["bounty_amount"] == 5 * GEN

    system.core.set_bounty(brand_id, 25 * GEN)
    assert system.core.get_pool(brand_id)["bounty_amount"] == 25 * GEN
    assert BOUNTY_STEP == 5 * GEN


@pytest.mark.parametrize("bounty_gen", [5, 10, 25, 50])
def test_required_stake_is_whole_gen_and_one_fifth_of_bounty(
    system, bounty_gen
):
    brand_id = _register_brand(system)
    bounty = bounty_gen * GEN
    system.core.set_bounty(brand_id, bounty)

    stake = system.core.get_required_stake(brand_id)
    assert stake % GEN == 0
    assert stake == bounty // 5
    assert stake >= MIN_STAKE_ABS


def test_appeal_stake_is_twice_stake_and_whole_gen(system):
    brand_id = _register_brand(system)
    system.core.set_bounty(brand_id, 25 * GEN)

    stake = system.core.get_required_stake(brand_id)
    appeal_stake = 2 * stake

    assert appeal_stake == 10 * GEN
    assert appeal_stake % GEN == 0


def test_first_deposit_minimum_and_smaller_later_top_up(system):
    brand_id = _register_brand(system)

    system.set_caller(system.admin, value=4 * GEN)
    with pytest.raises(ValueError, match="ERR_MIN_DEPOSIT"):
        system.core.fund_pool(brand_id)

    system.set_caller(system.admin, value=5 * GEN)
    system.core.fund_pool(brand_id)
    assert system.core.get_pool(brand_id)["balance"] == MIN_FIRST_DEPOSIT

    system.set_caller(system.admin, value=1 * GEN)
    system.core.fund_pool(brand_id)
    assert system.core.get_pool(brand_id)["balance"] == 6 * GEN


def test_confirmed_settlement_exact_whole_gen_pool_arithmetic(system):
    brand_id = _register_brand(system)
    system.set_caller(system.admin, value=5 * GEN)
    system.core.fund_pool(brand_id)
    system.set_caller(system.admin)
    system.core.set_bounty(brand_id, 5 * GEN)

    stake = system.core.get_required_stake(brand_id)
    assert stake == 1 * GEN

    gl.set_time(1_000_000)
    system.set_caller(system.hunter, value=stake)
    report_id = system.core.submit_report(
        brand_id, "https://phish-acme.com/login"
    )

    pool_after_submit = system.core.get_pool(brand_id)
    assert pool_after_submit["balance"] == 5 * GEN
    assert pool_after_submit["reserved"] == 5 * GEN

    gl.web_pages["https://acme.com"] = "Official Acme page"
    gl.web_pages["https://phish-acme.com/login"] = "Fake Acme login page"
    verdict = {
        "verdict": "CONFIRMED_PHISHING",
        "confidence": 90,
        "signals": [1, 4],
        "evidence_sufficient": True,
        "reason": "Brand mimicry and credential harvesting are present.",
    }
    gl.prompt_responses = [verdict, verdict]
    system.set_caller(system.hunter)
    system.core.adjudicate(report_id)

    gl.set_time(1_000_000 + APPEAL_WINDOW)
    gl.transfers.clear()
    system.core.settle(report_id)

    final_pool = system.core.get_pool(brand_id)
    assert final_pool["balance"] == 0 * GEN
    assert final_pool["reserved"] == 0 * GEN
    assert system.core.get_report(report_id)["status"] == STATUS_FINAL_CONFIRMED
    assert gl.transfers == [(system.hunter, 6 * GEN)]
