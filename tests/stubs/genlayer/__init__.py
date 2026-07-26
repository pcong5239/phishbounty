"""Minimal GenLayer runtime stub package for unit testing."""

from __future__ import annotations

from typing import Any


class Address:
    """Wraps a hex string, equality by normalized value."""

    def __init__(self, value: str | Address):
        if isinstance(value, Address):
            self.value = value.value
        elif isinstance(value, str):
            self.value = value.lower().strip()
        else:
            self.value = str(value).lower().strip()

    def __eq__(self, other: object) -> bool:
        if isinstance(other, Address):
            return self.value == other.value
        if isinstance(other, str):
            return self.value == other.lower().strip()
        return False

    def __hash__(self) -> int:
        return hash(self.value)

    def __str__(self) -> str:
        return self.value

    def __repr__(self) -> str:
        return f"Address('{self.value}')"


class TreeMap(dict):
    """Dict-backed TreeMap stub for GenLayer testing."""

    def __class_getitem__(cls, item: Any) -> type:
        return cls

    def get(self, key: Any, default: Any = None) -> Any:
        return super().get(key, default)


class DynArray(list):
    """List-backed DynArray stub for GenLayer testing."""

    def __class_getitem__(cls, item: Any) -> type:
        return cls


u8 = int
u64 = int
u256 = int


class _Message:
    def __init__(self) -> None:
        self.sender_address = Address("0x0000000000000000000000000000000000000000")
        self.value = 0

    @property
    def sender(self) -> Address:
        return self.sender_address


class _Block:
    def __init__(self) -> None:
        self.timestamp = 1_000_000


class _Public:
    @staticmethod
    def view(func: Any) -> Any:
        func.__is_view__ = True
        return func

    @staticmethod
    def write(func: Any) -> Any:
        func.__is_write__ = True
        return func


class Contract:
    """Base class for GenLayer Intelligent Contracts."""

    def __new__(cls, *args: Any, **kwargs: Any) -> Any:
        instance = super().__new__(cls)
        for base in reversed(cls.__mro__):
            if hasattr(base, "__annotations__"):
                for name, type_hint in base.__annotations__.items():
                    origin = getattr(type_hint, "__origin__", type_hint)
                    if origin is TreeMap or type_hint is TreeMap:
                        setattr(instance, name, TreeMap())
                    elif origin is DynArray or type_hint is DynArray:
                        setattr(instance, name, DynArray())
        return instance


class _GL:
    def __init__(self) -> None:
        self.Contract = Contract
        self.public = _Public()
        self.message = _Message()
        self.block = _Block()
        self.contracts: dict[Address, Any] = {}

    def get_contract_at(self, addr: Address | str) -> Any:
        a = Address(addr)
        if a not in self.contracts:
            raise KeyError(f"No contract registered at address {a}")
        return self.contracts[a]

    def register_contract(self, addr: Address | str, instance: Any) -> None:
        a = Address(addr)
        self.contracts[a] = instance

    def set_time(self, ts: int) -> None:
        self.block.timestamp = ts

    def advance_time(self, seconds: int) -> None:
        self.block.timestamp += seconds


gl = _GL()

__all__ = [
    "gl",
    "Contract",
    "Address",
    "TreeMap",
    "DynArray",
    "u8",
    "u64",
    "u256",
]
