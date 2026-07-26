from __future__ import annotations

import sys
from pathlib import Path

stubs_dir = str(Path(__file__).parent / "stubs")
contracts_dir = str(Path(__file__).parent.parent / "contracts")
if stubs_dir not in sys.path:
    sys.path.insert(0, stubs_dir)
if contracts_dir not in sys.path:
    sys.path.insert(0, contracts_dir)

import pytest
from blocklist_log import Contract as BlocklistLogContract
from brand_registry import Contract as BrandRegistryContract
from genlayer import Address, gl
from phish_report_core import Contract as PhishReportCoreContract


@pytest.fixture
def registry():
    c = BrandRegistryContract()
    default_sender = Address("0x1111111111111111111111111111111111111111")
    gl.message.sender_address = default_sender
    gl.message.value = 0

    def set_caller(addr: str | Address) -> None:
        gl.message.sender_address = Address(addr)

    c.set_caller = set_caller
    return c


@pytest.fixture
def system():
    reg_addr = Address("0x1000000000000000000000000000000000000001")
    blk_addr = Address("0x1000000000000000000000000000000000000002")
    core_addr = Address("0x1000000000000000000000000000000000000003")

    deployer = Address("0x1111111111111111111111111111111111111111")
    admin = Address("0x2222222222222222222222222222222222222222")
    hunter = Address("0x3333333333333333333333333333333333333333")

    gl.message.sender_address = deployer
    gl.message.value = 0
    gl.set_time(1_000_000)

    reg = BrandRegistryContract()
    blk = BlocklistLogContract()
    core = PhishReportCoreContract(reg_addr, blk_addr)

    gl.register_contract(reg_addr, reg)
    gl.register_contract(blk_addr, blk)
    gl.register_contract(core_addr, core)

    # Set writer of blocklist to core
    gl.message.sender_address = deployer
    blk.set_writer(core.address)

    class SystemEnv:
        def __init__(self):
            self.registry = reg
            self.blocklist = blk
            self.core = core
            self.reg_addr = reg_addr
            self.blk_addr = blk_addr
            self.core_addr = core_addr
            self.deployer = deployer
            self.admin = admin
            self.hunter = hunter

        def set_caller(self, addr: str | Address, value: int = 0) -> None:
            gl.message.sender_address = Address(addr)
            gl.message.value = value

    return SystemEnv()
