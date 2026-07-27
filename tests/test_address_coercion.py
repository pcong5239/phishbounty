import pytest
from blocklist_log import (
    Contract as BlocklistLogContract,
    _coerce_address as coerce_blocklist_address,
)
from brand_registry import Contract as BrandRegistryContract
from genlayer import Address, gl
from phish_report_core import (
    BOUNTY_MIN,
    MIN_FIRST_DEPOSIT,
    Contract as PhishReportCoreContract,
    _coerce_address as coerce_core_address,
)


REGISTRY_HEX = "0x1000000000000000000000000000000000000001"
BLOCKLIST_HEX = "0x1000000000000000000000000000000000000002"
CORE_HEX = "0x1000000000000000000000000000000000000003"
DEPLOYER_HEX = "0x1111111111111111111111111111111111111111"
ADMIN_HEX = "0x2222222222222222222222222222222222222222"
HUNTER_HEX = "0x3333333333333333333333333333333333333333"


def _set_caller(address: str | Address, value: int = 0) -> None:
    gl.message.sender_address = (
        address if isinstance(address, Address) else Address(address)
    )
    gl.message.value = value


def _build_linked_trio(use_int_constructor_args: bool):
    gl.contracts.clear()
    gl.web_pages.clear()
    gl.prompt_responses.clear()
    gl.prompts_history.clear()
    gl.transfers.clear()
    gl.wrap_leader_result = False

    _set_caller(DEPLOYER_HEX)
    registry = BrandRegistryContract()
    blocklist = BlocklistLogContract()

    registry_arg = (
        int(REGISTRY_HEX, 16) if use_int_constructor_args else REGISTRY_HEX
    )
    blocklist_arg = (
        int(BLOCKLIST_HEX, 16) if use_int_constructor_args else BLOCKLIST_HEX
    )
    core = PhishReportCoreContract(registry_arg, blocklist_arg)

    gl.register_contract(REGISTRY_HEX, registry)
    gl.register_contract(BLOCKLIST_HEX, blocklist)
    gl.register_contract(CORE_HEX, core)

    writer_arg = int(CORE_HEX, 16) if use_int_constructor_args else CORE_HEX
    _set_caller(DEPLOYER_HEX)
    blocklist.set_writer(writer_arg)

    assert core.registry_addr == Address(REGISTRY_HEX)
    assert core.blocklist_addr == Address(BLOCKLIST_HEX)
    assert blocklist.writer == Address(CORE_HEX)
    return registry, blocklist, core


def _submit_report(registry, core) -> int:
    _set_caller(ADMIN_HEX)
    brand_id = registry.register_brand("Brand Acme", "acme.com", "Scope")

    _set_caller(ADMIN_HEX, value=MIN_FIRST_DEPOSIT)
    core.fund_pool(brand_id)
    _set_caller(ADMIN_HEX)
    core.set_bounty(brand_id, BOUNTY_MIN)

    stake = core.get_required_stake(brand_id)
    _set_caller(HUNTER_HEX, value=stake)
    return core.submit_report(brand_id, "https://evil-acme.com/login")


def test_core_constructor_accepts_hex_string_addresses():
    _build_linked_trio(use_int_constructor_args=False)


def test_int_address_entry_points_and_submit_report_happy_path():
    registry, blocklist, core = _build_linked_trio(
        use_int_constructor_args=True
    )
    report_id = _submit_report(registry, core)
    assert report_id == 1

    hunter_int = int(HUNTER_HEX, 16)
    assert core.get_hunter_stats(hunter_int) == core.get_hunter_stats(HUNTER_HEX)
    assert core.get_hunter_stats(hunter_int)["open"] == 1

    _set_caller(CORE_HEX)
    blocklist.append_event("evil-acme.com", 1, report_id, hunter_int)
    blocklist.append_event("evil-acme.com", 2, report_id, hunter_int)

    assert blocklist.get_hunter_confirmed(hunter_int) == 1
    assert (
        blocklist.get_hunter_confirmed(hunter_int)
        == blocklist.get_hunter_confirmed(HUNTER_HEX)
    )
    assert blocklist.get_hunter_neutralized(hunter_int) == 1
    assert (
        blocklist.get_hunter_neutralized(hunter_int)
        == blocklist.get_hunter_neutralized(HUNTER_HEX)
    )


@pytest.mark.parametrize(
    "bad_value",
    [
        -1,
        1 << 160,
        b"\x01" * 19,
        "0xZZ",
        None,
    ],
)
@pytest.mark.parametrize(
    "coerce",
    [
        coerce_blocklist_address,
        coerce_core_address,
    ],
)
def test_address_helpers_reject_malformed_inputs(coerce, bad_value):
    with pytest.raises(ValueError, match="ERR_ADDRESS"):
        coerce(bad_value)


def test_all_changed_public_boundaries_reject_malformed_address():
    with pytest.raises(ValueError, match="ERR_ADDRESS"):
        PhishReportCoreContract(None, BLOCKLIST_HEX)

    _set_caller(DEPLOYER_HEX)
    blocklist = BlocklistLogContract()
    with pytest.raises(ValueError, match="ERR_ADDRESS"):
        blocklist.set_writer(None)
    with pytest.raises(ValueError, match="ERR_ADDRESS"):
        blocklist.append_event("evil.com", 1, 1, None)
    with pytest.raises(ValueError, match="ERR_ADDRESS"):
        blocklist.get_hunter_confirmed(None)
    with pytest.raises(ValueError, match="ERR_ADDRESS"):
        blocklist.get_hunter_neutralized(None)

    core = PhishReportCoreContract(REGISTRY_HEX, BLOCKLIST_HEX)
    with pytest.raises(ValueError, match="ERR_ADDRESS"):
        core.get_hunter_stats(None)


def test_stub_address_rejects_plain_integer():
    with pytest.raises((TypeError, OverflowError)):
        Address(int(REGISTRY_HEX, 16))


def test_stub_address_rejects_already_coerced_address():
    address = Address("0x0000000000000000000000000000000000000001")

    with pytest.raises(TypeError, match="cannot convert 'Address' object to bytes"):
        Address(address)
