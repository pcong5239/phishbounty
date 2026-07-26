from __future__ import annotations

import sys
from pathlib import Path

# Prepend tests/stubs to sys.path before importing contracts
stubs_dir = str(Path(__file__).parent / "stubs")
contracts_dir = str(Path(__file__).parent.parent / "contracts")
if stubs_dir not in sys.path:
    sys.path.insert(0, stubs_dir)
if contracts_dir not in sys.path:
    sys.path.insert(0, contracts_dir)

import pytest
from genlayer import Address, gl


@pytest.fixture
def registry():
    from brand_registry import Contract as BrandRegistryContract

    c = BrandRegistryContract()
    default_sender = Address("0x1111111111111111111111111111111111111111")
    gl.message.sender_address = default_sender

    def set_caller(addr: str | Address) -> None:
        gl.message.sender_address = Address(addr)

    c.set_caller = set_caller
    return c
