"""Minimal GenLayer runtime stub package for unit testing."""

from __future__ import annotations

from typing import Any


class FetchError(Exception):
    pass


class ConsensusError(Exception):
    pass


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
        self.contract_address = Address("0x0000000000000000000000000000000000000000")
        self.value = 0

class _PublicWrite:
    def __call__(self, func: Any) -> Any:
        func.__is_write__ = True
        func.__is_payable__ = False
        return func

    def payable(self, func: Any) -> Any:
        func.__is_write__ = True
        func.__is_payable__ = True
        return func


class _Public:
    def __init__(self) -> None:
        self.write = _PublicWrite()

    @staticmethod
    def view(func: Any) -> Any:
        func.__is_view__ = True
        return func


class _EVM:
    @staticmethod
    def contract_interface(interface_cls: type) -> type:
        def __init__(self, address: Address | str) -> None:
            self._address = Address(address)

        def emit_transfer(self, *, value: int) -> None:
            gl.transfers.append((self._address, int(value)))

        interface_cls.__init__ = __init__
        interface_cls.emit_transfer = emit_transfer
        return interface_cls


class Contract:
    """Base class for GenLayer Intelligent Contracts."""

    def __new__(cls, *args: Any, **kwargs: Any) -> Any:
        instance = super().__new__(cls)
        instance.address = Address("0x0000000000000000000000000000000000000000")
        for base in reversed(cls.__mro__):
            if hasattr(base, "__annotations__"):
                for name, type_hint in base.__annotations__.items():
                    origin = getattr(type_hint, "__origin__", type_hint)
                    if origin is TreeMap or type_hint is TreeMap:
                        setattr(instance, name, TreeMap())
                    elif origin is DynArray or type_hint is DynArray:
                        setattr(instance, name, DynArray())
        return instance

    def __getattribute__(self, name: str) -> Any:
        attr = super().__getattribute__(name)
        if callable(attr) and hasattr(attr, "__is_write__"):
            def wrapper(*args: Any, **kwargs: Any) -> Any:
                if not getattr(attr, "__is_payable__", False) and gl.message.value > 0:
                    raise ValueError("ERR_NON_PAYABLE")
                previous_contract = gl.message.contract_address
                gl.message.contract_address = self.address
                try:
                    return attr(*args, **kwargs)
                finally:
                    gl.message.contract_address = previous_contract
            return wrapper
        return attr


class _ContractProxy:
    def __init__(self, target: Any) -> None:
        self._target = target

    def __getattr__(self, name: str) -> Any:
        raise AttributeError(
            f"Cross-contract method '{name}' requires .view() or .emit()"
        )

    def view(self) -> _ViewProxy:
        return _ViewProxy(self._target)

    def emit(self, value: int = 0, on: str = "finalized") -> _WriteProxy:
        if on not in ("accepted", "finalized"):
            raise ValueError("ERR_EMIT_TIMING")
        return _WriteProxy(
            self._target,
            gl.message.contract_address,
            value,
        )


class _ViewProxy:
    def __init__(self, target: Any) -> None:
        self._target = target

    def __getattr__(self, name: str) -> Any:
        declared = getattr(type(self._target), name, None)
        if not callable(declared) or not hasattr(declared, "__is_view__"):
            raise AttributeError(
                f"Cross-contract view cannot call non-view method '{name}'"
            )
        return getattr(self._target, name)


class _WriteProxy:
    def __init__(self, target: Any, sender: Address, value: int) -> None:
        self._target = target
        self._sender = Address(sender)
        self._value = value

    def __getattr__(self, name: str) -> Any:
        declared = getattr(type(self._target), name, None)
        if not callable(declared) or not hasattr(declared, "__is_write__"):
            raise AttributeError(
                f"Cross-contract emit cannot call non-write method '{name}'"
            )
        attr = getattr(self._target, name)

        def invoke(*args: Any, **kwargs: Any) -> Any:
            previous_sender = gl.message.sender_address
            previous_value = gl.message.value
            try:
                gl.message.sender_address = self._sender
                gl.message.value = self._value
                return attr(*args, **kwargs)
            finally:
                gl.message.sender_address = previous_sender
                gl.message.value = previous_value

        return invoke


class _NondetWeb:
    def render(self, url: str, mode: str = "text") -> str:
        if url not in gl.web_pages or gl.web_pages[url] is None:
            raise FetchError(f"HTTP_FETCH_FAILED: {url}")
        return gl.web_pages[url]


class _Nondet:
    def __init__(self) -> None:
        self.web = _NondetWeb()

    def exec_prompt(self, prompt: str) -> str:
        gl.prompts_history.append(prompt)
        if gl.prompt_responses:
            return gl.prompt_responses.pop(0)
        return "{}"


class _VM:
    def run_nondet_unsafe(self, leader_fn: Any, validator_fn: Any) -> Any:
        payload = leader_fn()
        ok = validator_fn(payload)
        if not ok:
            raise ConsensusError("MAJORITY_DISAGREE")
        return payload


class _GL:
    def __init__(self) -> None:
        self.Contract = Contract
        self.public = _Public()
        self.evm = _EVM()
        self.message = _Message()
        self.nondet = _Nondet()
        self.vm = _VM()
        self.contracts: dict[Address, Any] = {}
        self.web_pages: dict[str, str | None] = {}
        self.prompt_responses: list[str] = []
        self.prompts_history: list[str] = []
        self.transfers: list[tuple[Address, int]] = []
        self.current_time = 1_000_000

    def get_contract_at(self, addr: Address | str) -> Any:
        a = Address(addr)
        if a not in self.contracts:
            raise KeyError(f"No contract registered at address {a}")
        return _ContractProxy(self.contracts[a])

    def register_contract(self, addr: Address | str, instance: Any) -> None:
        a = Address(addr)
        instance.address = a
        self.contracts[a] = instance

    def set_time(self, ts: int) -> None:
        self.current_time = ts

    def advance_time(self, seconds: int) -> None:
        self.current_time += seconds

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
    "FetchError",
    "ConsensusError",
]
