import json

import pytest
from genlayer import gl
from phish_report_core import (
    APPEAL_WINDOW,
    GEN,
    MIN_FIRST_DEPOSIT,
    REVERIFY_COOLDOWN,
    STATUS_FINAL_CLEARED,
    STATUS_FINAL_CONFIRMED,
    VERDICT_SUSPICIOUS,
)


BOUNTY = 10 * GEN
INITIAL_POOL = MIN_FIRST_DEPOSIT * 20
URL = "https://phish-acme.com/login"
DOMAIN = "phish-acme.com"


def _verdict(name: str) -> str:
    if name == "CONFIRMED_PHISHING":
        payload = {
            "verdict": name,
            "confidence": 88,
            "signals": [1, 4],
            "evidence_sufficient": True,
            "reason": "Brand mimicry and credential harvesting are present.",
        }
    elif name == "SUSPICIOUS":
        payload = {
            "verdict": name,
            "confidence": 55,
            "signals": [1],
            "evidence_sufficient": True,
            "reason": "Brand reference exists but stronger evidence is missing.",
        }
    else:
        payload = {
            "verdict": "CLEARED",
            "confidence": 95,
            "signals": [8],
            "evidence_sufficient": True,
            "reason": "No impersonation signals were observed.",
        }
    return json.dumps(payload)


def _setup_report(system, url: str = URL):
    system.set_caller(system.admin)
    brand_id = system.registry.register_brand("Brand Acme", "acme.com", "Scope")
    system.set_caller(system.admin, value=INITIAL_POOL)
    system.core.fund_pool(brand_id)
    system.set_caller(system.admin)
    system.core.set_bounty(brand_id, BOUNTY)
    stake = system.core.get_required_stake(brand_id)
    gl.set_time(1_000_000)
    system.set_caller(system.hunter, value=stake)
    report_id = system.core.submit_report(brand_id, url)
    gl.web_pages["https://acme.com"] = "Official Acme page"
    gl.web_pages[url] = "Fake Acme login"
    return brand_id, report_id, stake


def _adjudicate(system, report_id: int, verdict: str) -> None:
    response = _verdict(verdict)
    gl.prompt_responses = [response, response]
    system.set_caller(system.hunter)
    system.core.adjudicate(report_id)


def test_confirmed_settlement_guards_and_accounting(system):
    brand_id, report_id, stake = _setup_report(system)
    _adjudicate(system, report_id, "CONFIRMED_PHISHING")

    with pytest.raises(ValueError, match="ERR_WINDOW_OPEN"):
        system.core.settle(report_id)

    gl.set_time(1_000_000 + APPEAL_WINDOW)
    gl.transfers.clear()
    system.core.settle(report_id)

    report = system.core.get_report(report_id)
    pool = system.core.get_pool(brand_id)
    stats = system.core.get_hunter_stats(system.hunter)
    assert report["status"] == STATUS_FINAL_CONFIRMED
    assert gl.transfers == [(system.hunter, BOUNTY + stake)]
    assert pool["balance"] == INITIAL_POOL - BOUNTY
    assert pool["reserved"] == 0
    assert system.blocklist.get_domain_state(DOMAIN) == 1
    assert [event["kind"] for event in system.blocklist.get_domain_history(DOMAIN)] == [1]
    assert system.core.confirmed_domain[DOMAIN] == report_id
    assert system.core.pending_domain[DOMAIN] == 0
    assert stats == {"open": 0, "confirmed": 1, "cleared": 0, "suspicious": 0}

    with pytest.raises(ValueError, match="ERR_NOT_SETTLEABLE"):
        system.core.settle(report_id)


def test_suspicious_settlement_refunds_stake_without_bounty(system):
    brand_id, report_id, stake = _setup_report(system)
    _adjudicate(system, report_id, "SUSPICIOUS")
    gl.set_time(1_000_000 + APPEAL_WINDOW)
    gl.transfers.clear()
    system.core.settle(report_id)

    report = system.core.get_report(report_id)
    pool = system.core.get_pool(brand_id)
    stats = system.core.get_hunter_stats(system.hunter)
    assert report["status"] == STATUS_FINAL_CLEARED
    assert report["verdict"] == VERDICT_SUSPICIOUS
    assert gl.transfers == [(system.hunter, stake)]
    assert pool["balance"] == INITIAL_POOL
    assert pool["reserved"] == 0
    assert system.blocklist.get_event_count() == 0
    assert stats["open"] == 0
    assert stats["suspicious"] == 1


def test_cleared_settlement_slashes_stake_to_pool(system):
    brand_id, report_id, stake = _setup_report(system)
    _adjudicate(system, report_id, "CLEARED")
    gl.set_time(1_000_000 + APPEAL_WINDOW)
    gl.transfers.clear()
    system.core.settle(report_id)

    report = system.core.get_report(report_id)
    pool = system.core.get_pool(brand_id)
    stats = system.core.get_hunter_stats(system.hunter)
    assert report["status"] == STATUS_FINAL_CLEARED
    assert gl.transfers == []
    assert pool["balance"] == INITIAL_POOL + stake
    assert pool["reserved"] == 0
    assert system.core.pending_domain[DOMAIN] == 0
    assert stats["open"] == 0
    assert stats["cleared"] == 1


def test_full_list_neutralize_relist_cycle(system):
    brand_id, first_report, stake = _setup_report(system)
    _adjudicate(system, first_report, "CONFIRMED_PHISHING")
    gl.set_time(1_000_000 + APPEAL_WINDOW)
    system.core.settle(first_report)
    assert system.blocklist.get_domain_state(DOMAIN) == 1

    gl.advance_time(REVERIFY_COOLDOWN)
    gl.web_pages[URL] = None
    neutralizer = "0x4444444444444444444444444444444444444444"
    system.set_caller(neutralizer)
    system.core.reverify(DOMAIN)
    assert system.blocklist.get_domain_state(DOMAIN) == 2
    assert system.blocklist.get_hunter_neutralized(neutralizer) == 1

    gl.web_pages[URL] = "Fake Acme login returned"
    system.set_caller(system.hunter, value=stake)
    second_report = system.core.submit_report(brand_id, URL)
    _adjudicate(system, second_report, "CONFIRMED_PHISHING")
    gl.advance_time(APPEAL_WINDOW)
    system.core.settle(second_report)

    history = system.blocklist.get_domain_history(DOMAIN)
    assert [event["kind"] for event in history] == [1, 2, 3]
    assert [event["report_id"] for event in history] == [
        first_report,
        first_report,
        second_report,
    ]
    assert system.blocklist.get_domain_state(DOMAIN) == 1
    assert system.core.confirmed_domain[DOMAIN] == second_report
    pool = system.core.get_pool(brand_id)
    assert pool["balance"] == INITIAL_POOL - (2 * BOUNTY)
    assert pool["reserved"] == 0
