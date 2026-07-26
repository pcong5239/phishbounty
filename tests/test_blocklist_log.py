import pytest
from genlayer import Address, gl
from blocklist_log import Contract as BlocklistLogContract


@pytest.fixture
def blocklist():
    owner = Address("0x1111111111111111111111111111111111111111")
    gl.message.sender_address = owner
    c = BlocklistLogContract()

    def set_caller(addr: str | Address) -> None:
        gl.message.sender_address = Address(addr)

    c.set_caller = set_caller
    return c


def test_set_writer_authorization(blocklist):
    owner = "0x1111111111111111111111111111111111111111"
    writer = "0x2222222222222222222222222222222222222222"
    other = "0x3333333333333333333333333333333333333333"

    # Non-owner cannot set writer
    blocklist.set_caller(other)
    with pytest.raises(ValueError, match="ERR_NOT_OWNER"):
        blocklist.set_writer(writer)

    # Owner sets writer successfully
    blocklist.set_caller(owner)
    blocklist.set_writer(writer)
    assert blocklist.get_writer() == writer.lower()

    # Second set_writer rejected
    with pytest.raises(ValueError, match="ERR_WRITER_SET"):
        blocklist.set_writer(other)


def test_append_event_authorization_and_guards(blocklist):
    owner = "0x1111111111111111111111111111111111111111"
    writer = "0x2222222222222222222222222222222222222222"
    hunter = "0x4444444444444444444444444444444444444444"

    blocklist.set_caller(owner)
    blocklist.set_writer(writer)

    # Non-writer rejected
    blocklist.set_caller(owner)
    with pytest.raises(ValueError, match="ERR_NOT_WRITER"):
        blocklist.append_event("evil.com", 1, 100, hunter)

    # Bad kind rejected
    blocklist.set_caller(writer)
    with pytest.raises(ValueError, match="ERR_KIND"):
        blocklist.append_event("evil.com", 99, 100, hunter)

    # Malformed domain rejected (un-normalized casing, trailing dot, invalid format)
    with pytest.raises(ValueError, match="ERR_DOMAIN_FORMAT"):
        blocklist.append_event("EVIL.COM", 1, 100, hunter)

    with pytest.raises(ValueError, match="ERR_DOMAIN_FORMAT"):
        blocklist.append_event("evil.com.", 1, 100, hunter)

    with pytest.raises(ValueError, match="ERR_DOMAIN_FORMAT"):
        blocklist.append_event("https://evil.com", 1, 100, hunter)


def test_lifecycle_and_state_machine(blocklist):
    owner = "0x1111111111111111111111111111111111111111"
    writer = "0x2222222222222222222222222222222222222222"
    hunter = "0x4444444444444444444444444444444444444444"

    blocklist.set_caller(owner)
    blocklist.set_writer(writer)
    blocklist.set_caller(writer)

    domain = "phish.example.com"

    # Initial state
    assert blocklist.get_domain_state(domain) == 0
    assert blocklist.is_blocked(domain) is False
    assert blocklist.get_hunter_confirmed(hunter) == 0

    # Invalid transitions before LISTED
    with pytest.raises(ValueError, match="ERR_STATE"):
        blocklist.append_event(domain, 2, 1, hunter)  # NEUTRALIZED on state 0

    with pytest.raises(ValueError, match="ERR_STATE"):
        blocklist.append_event(domain, 3, 1, hunter)  # RELISTED on state 0

    # 1. LISTED
    gl.set_time(1000)
    blocklist.append_event(domain, 1, 101, hunter)
    assert blocklist.get_domain_state(domain) == 1
    assert blocklist.is_blocked(domain) is True
    assert blocklist.get_hunter_confirmed(hunter) == 1

    # Invalid transitions while LISTED
    with pytest.raises(ValueError, match="ERR_STATE"):
        blocklist.append_event(domain, 1, 102, hunter)  # LISTED twice

    with pytest.raises(ValueError, match="ERR_STATE"):
        blocklist.append_event(domain, 3, 102, hunter)  # RELISTED on state 1

    # 2. NEUTRALIZED
    gl.set_time(2000)
    blocklist.append_event(domain, 2, 103, hunter)
    assert blocklist.get_domain_state(domain) == 2
    assert blocklist.is_blocked(domain) is False
    assert blocklist.get_hunter_confirmed(hunter) == 1  # No increment on NEUTRALIZED

    # Invalid transitions while NEUTRALIZED
    with pytest.raises(ValueError, match="ERR_STATE"):
        blocklist.append_event(domain, 1, 104, hunter)  # LISTED on state 2

    with pytest.raises(ValueError, match="ERR_STATE"):
        blocklist.append_event(domain, 2, 104, hunter)  # NEUTRALIZED on state 2

    # 3. RELISTED
    gl.set_time(3000)
    blocklist.append_event(domain, 3, 105, hunter)
    assert blocklist.get_domain_state(domain) == 1
    assert blocklist.is_blocked(domain) is True
    assert blocklist.get_hunter_confirmed(hunter) == 2  # Increments on RELISTED

    # History verification
    history = blocklist.get_domain_history(domain)
    assert len(history) == 3
    assert [e["kind"] for e in history] == [1, 2, 3]
    assert [e["report_id"] for e in history] == [101, 103, 105]
    assert [e["at"] for e in history] == [1000, 2000, 3000]

    # Recent events verification (newest first)
    recent = blocklist.get_recent_events(10)
    assert len(recent) == 3
    assert recent[0]["id"] == 3
    assert recent[0]["kind"] == 3
    assert recent[0]["domain"] == domain
    assert recent[2]["id"] == 1


def test_views_malformed_and_unknown_inputs(blocklist):
    assert blocklist.is_blocked("unknown.com") is False
    assert blocklist.is_blocked("https://malformed.com") is False
    assert blocklist.get_domain_state("https://malformed.com") == 0
    assert blocklist.get_domain_history("https://malformed.com") == []
    assert blocklist.get_recent_events(5) == []
    assert blocklist.get_event_count() == 0
