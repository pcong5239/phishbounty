import pytest
from genlayer import Address, gl
import contracts.phish_report_core as phish_report_core

DEPLOYER = Address("0x1111111111111111111111111111111111111111")
OTHER_USER = Address("0x2222222222222222222222222222222222222222")
REGISTRY_ADDR = Address("0x3333333333333333333333333333333333333333")
BLOCKLIST_ADDR = Address("0x4444444444444444444444444444444444444444")


def test_constructor_registration():
    gl.message.sender_address = DEPLOYER
    gl.message.value = 0
    core = phish_report_core.Contract(REGISTRY_ADDR, BLOCKLIST_ADDR)

    root = core._storage_root
    upgraders = list(root.upgraders.get())
    assert len(upgraders) == 1
    assert upgraders[0] == DEPLOYER


def test_authorized_replacement():
    gl.message.sender_address = DEPLOYER
    gl.message.value = 0
    core = phish_report_core.Contract(REGISTRY_ADDR, BLOCKLIST_ADDR)

    core.upgrade(b"version-two")
    code_bytes = bytes(core._storage_root.code.get())
    assert code_bytes == b"version-two"

    core.upgrade(b"version-three")
    code_bytes_updated = bytes(core._storage_root.code.get())
    assert code_bytes_updated == b"version-three"


def test_unauthorized_rejection():
    gl.message.sender_address = DEPLOYER
    gl.message.value = 0
    core = phish_report_core.Contract(REGISTRY_ADDR, BLOCKLIST_ADDR)

    core.upgrade(b"version-two")
    assert bytes(core._storage_root.code.get()) == b"version-two"

    gl.message.sender_address = OTHER_USER
    with pytest.raises(Exception, match="ERR_NOT_UPGRADER"):
        core.upgrade(b"malicious")

    assert bytes(core._storage_root.code.get()) == b"version-two"


def test_method_metadata_and_non_payable():
    gl.message.sender_address = DEPLOYER
    gl.message.value = 0
    core = phish_report_core.Contract(REGISTRY_ADDR, BLOCKLIST_ADDR)

    raw_fn = getattr(phish_report_core.Contract, "upgrade")
    assert getattr(raw_fn, "__is_write__", False) is True
    assert getattr(raw_fn, "__is_payable__", False) is False

    gl.message.value = 100
    with pytest.raises(ValueError, match="ERR_NON_PAYABLE"):
        core.upgrade(b"should-fail")
