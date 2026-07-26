import json

import pytest
from genlayer import gl
from phish_report_core import (
    APPEAL_WINDOW,
    MIN_FIRST_DEPOSIT,
    STATUS_APPEALED,
    STATUS_CLEARED,
    STATUS_CONFIRMED,
    STATUS_FINAL_CLEARED,
    STATUS_FINAL_CONFIRMED,
)


BOUNTY = 10_000_000_000_000_000
INITIAL_POOL = MIN_FIRST_DEPOSIT * 20
URL = "https://phish-acme.com/login"
DOMAIN = "phish-acme.com"


def _verdict(name: str, evidence_sufficient: bool = True) -> str:
    if name == "CONFIRMED_PHISHING":
        payload = {
            "verdict": name,
            "confidence": 88,
            "signals": [1, 4],
            "evidence_sufficient": evidence_sufficient,
            "reason": "Brand mimicry and credential harvesting are present.",
        }
    elif name == "SUSPICIOUS":
        payload = {
            "verdict": name,
            "confidence": 55,
            "signals": [1],
            "evidence_sufficient": evidence_sufficient,
            "reason": "Some signals exist but stronger evidence is missing.",
        }
    else:
        payload = {
            "verdict": "CLEARED",
            "confidence": 95,
            "signals": [8],
            "evidence_sufficient": evidence_sufficient,
            "reason": "No impersonation signals were observed.",
        }
    return json.dumps(payload)


def _setup_adjudicated(system, original_verdict: str):
    system.set_caller(system.admin)
    brand_id = system.registry.register_brand("Brand Acme", "acme.com", "Scope")
    system.set_caller(system.admin, value=INITIAL_POOL)
    system.core.fund_pool(brand_id)
    system.set_caller(system.admin)
    system.core.set_bounty(brand_id, BOUNTY)
    stake = system.core.get_required_stake(brand_id)
    gl.set_time(1_000_000)
    system.set_caller(system.hunter, value=stake)
    report_id = system.core.submit_report(brand_id, URL)
    gl.web_pages["https://acme.com"] = "Official Acme page"
    gl.web_pages[URL] = "Fake Acme login"
    response = _verdict(original_verdict)
    gl.prompt_responses = [response, response]
    system.set_caller(system.hunter)
    system.core.adjudicate(report_id)
    return brand_id, report_id, stake


def _appeal(system, report_id: int, stake: int, original_verdict: str) -> None:
    caller = system.admin if original_verdict == "CONFIRMED_PHISHING" else system.hunter
    system.set_caller(caller, value=2 * stake)
    system.core.appeal(report_id)
    assert system.core.get_report(report_id)["status"] == STATUS_APPEALED


def _resolve(system, report_id: int, verdict: str) -> None:
    response = _verdict(verdict)
    gl.prompt_responses = [response, response]
    gl.prompts_history.clear()
    system.set_caller(system.deployer)
    system.core.adjudicate(report_id)
    assert len(gl.prompts_history) == 2
    assert all("ADVERSARIAL-SKEPTIC-PASS" in prompt for prompt in gl.prompts_history)


def _paid_to(address) -> int:
    return sum(amount for recipient, amount in gl.transfers if recipient == address)


def test_appeal_guard_matrix(system):
    brand_id, report_id, stake = _setup_adjudicated(system, "CONFIRMED_PHISHING")

    system.set_caller(system.admin)
    with pytest.raises(ValueError, match="ERR_NOT_FOUND"):
        system.core.appeal(999)

    system.core.report_status[report_id] = 1
    with pytest.raises(ValueError, match="ERR_NOT_APPEALABLE"):
        system.core.appeal(report_id)

    system.core.report_status[report_id] = STATUS_CONFIRMED
    system.set_caller(system.hunter, value=2 * stake)
    with pytest.raises(ValueError, match="ERR_NOT_PARTY"):
        system.core.appeal(report_id)

    system.core.report_status[report_id] = STATUS_CLEARED
    system.set_caller(system.admin, value=2 * stake)
    with pytest.raises(ValueError, match="ERR_NOT_PARTY"):
        system.core.appeal(report_id)

    system.core.report_status[report_id] = STATUS_CONFIRMED
    system.set_caller(system.admin, value=(2 * stake) - 1)
    with pytest.raises(ValueError, match="ERR_APPEAL_STAKE"):
        system.core.appeal(report_id)
    system.set_caller(system.admin, value=(2 * stake) + 1)
    with pytest.raises(ValueError, match="ERR_APPEAL_STAKE"):
        system.core.appeal(report_id)

    gl.set_time(1_000_000 + APPEAL_WINDOW)
    system.set_caller(system.admin, value=2 * stake)
    with pytest.raises(ValueError, match="ERR_APPEAL_WINDOW"):
        system.core.appeal(report_id)


def test_brand_appeal_confirmed_flips_to_cleared(system):
    brand_id, report_id, stake = _setup_adjudicated(system, "CONFIRMED_PHISHING")
    _appeal(system, report_id, stake, "CONFIRMED_PHISHING")
    gl.transfers.clear()
    _resolve(system, report_id, "CLEARED")

    pool = system.core.get_pool(brand_id)
    report = system.core.get_report(report_id)
    assert report["status"] == STATUS_FINAL_CLEARED
    assert _paid_to(system.admin) == 2 * stake
    assert _paid_to(system.hunter) == 0
    assert pool["balance"] == INITIAL_POOL + stake
    assert pool["reserved"] == 0
    assert system.blocklist.get_event_count() == 0
    assert system.core.get_hunter_stats(system.hunter)["cleared"] == 1


def test_brand_appeal_confirmed_is_upheld(system):
    brand_id, report_id, stake = _setup_adjudicated(system, "CONFIRMED_PHISHING")
    _appeal(system, report_id, stake, "CONFIRMED_PHISHING")
    gl.transfers.clear()
    _resolve(system, report_id, "CONFIRMED_PHISHING")

    pool = system.core.get_pool(brand_id)
    assert system.core.get_report(report_id)["status"] == STATUS_FINAL_CONFIRMED
    assert _paid_to(system.hunter) == BOUNTY + stake + (2 * stake)
    assert _paid_to(system.admin) == 0
    assert pool["balance"] == INITIAL_POOL - BOUNTY
    assert pool["reserved"] == 0
    assert system.blocklist.get_domain_state(DOMAIN) == 1

    system.set_caller(system.admin, value=2 * stake)
    with pytest.raises(ValueError, match="ERR_NOT_APPEALABLE"):
        system.core.appeal(report_id)


def test_hunter_appeal_cleared_flips_to_confirmed(system):
    brand_id, report_id, stake = _setup_adjudicated(system, "CLEARED")
    _appeal(system, report_id, stake, "CLEARED")
    gl.transfers.clear()
    _resolve(system, report_id, "CONFIRMED_PHISHING")

    pool = system.core.get_pool(brand_id)
    assert system.core.get_report(report_id)["status"] == STATUS_FINAL_CONFIRMED
    assert _paid_to(system.hunter) == BOUNTY + stake + (2 * stake)
    assert pool["balance"] == INITIAL_POOL - BOUNTY
    assert pool["reserved"] == 0
    assert system.blocklist.get_domain_state(DOMAIN) == 1


def test_hunter_appeal_cleared_is_upheld_and_both_stakes_are_slashed(system):
    brand_id, report_id, stake = _setup_adjudicated(system, "CLEARED")
    _appeal(system, report_id, stake, "CLEARED")
    gl.transfers.clear()
    _resolve(system, report_id, "CLEARED")

    pool = system.core.get_pool(brand_id)
    assert system.core.get_report(report_id)["status"] == STATUS_FINAL_CLEARED
    assert gl.transfers == []
    assert pool["balance"] == INITIAL_POOL + (3 * stake)
    assert pool["reserved"] == 0
    assert system.core.get_hunter_stats(system.hunter)["cleared"] == 1


def test_suspicious_appeal_refunds_hunter_and_brand_stakes(system):
    brand_id, report_id, stake = _setup_adjudicated(system, "CONFIRMED_PHISHING")
    _appeal(system, report_id, stake, "CONFIRMED_PHISHING")
    gl.transfers.clear()
    _resolve(system, report_id, "SUSPICIOUS")

    pool = system.core.get_pool(brand_id)
    assert system.core.get_report(report_id)["status"] == STATUS_FINAL_CLEARED
    assert _paid_to(system.hunter) == stake
    assert _paid_to(system.admin) == 2 * stake
    assert pool["balance"] == INITIAL_POOL
    assert pool["reserved"] == 0
    assert system.core.get_hunter_stats(system.hunter)["suspicious"] == 1


def test_inconclusive_appeal_original_confirmed_stands(system):
    brand_id, report_id, stake = _setup_adjudicated(system, "CONFIRMED_PHISHING")
    _appeal(system, report_id, stake, "CONFIRMED_PHISHING")
    gl.transfers.clear()
    gl.web_pages[URL] = None
    system.set_caller(system.deployer)
    system.core.adjudicate(report_id)

    report = system.core.get_report(report_id)
    pool = system.core.get_pool(brand_id)
    assert report["status"] == STATUS_FINAL_CONFIRMED
    assert report["reason"] == "APPEAL_INCONCLUSIVE:FETCH_FAIL"
    assert _paid_to(system.admin) == 2 * stake
    assert _paid_to(system.hunter) == BOUNTY + stake
    assert pool["balance"] == INITIAL_POOL - BOUNTY
    assert pool["reserved"] == 0
    assert system.blocklist.get_domain_state(DOMAIN) == 1


def test_insufficient_hunter_appeal_original_cleared_stands_without_retry(system):
    brand_id, report_id, stake = _setup_adjudicated(system, "CLEARED")
    _appeal(system, report_id, stake, "CLEARED")
    gl.transfers.clear()
    insufficient = _verdict("SUSPICIOUS", evidence_sufficient=False)
    gl.prompt_responses = [insufficient, insufficient]
    system.set_caller(system.deployer)
    system.core.adjudicate(report_id)

    report = system.core.get_report(report_id)
    pool = system.core.get_pool(brand_id)
    stats = system.core.get_hunter_stats(system.hunter)
    assert report["status"] == STATUS_FINAL_CLEARED
    assert report["reason"] == "APPEAL_INCONCLUSIVE:INSUFFICIENT"
    assert report["retry_count"] == 0
    assert _paid_to(system.hunter) == 2 * stake
    assert pool["balance"] == INITIAL_POOL + stake
    assert pool["reserved"] == 0
    assert stats["open"] == 0
    assert stats["cleared"] == 1
    assert system.blocklist.get_event_count() == 0
