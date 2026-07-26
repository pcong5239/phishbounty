# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

"""Diagnostic probe: records the raw gl.message.value the runtime delivers.

Deploy on Studionet, call probe() with value entered as 1 (GEN) in the UI,
then read get_last_value():
  - returns 1                    -> runtime delivers whole-GEN integers
  - returns 1000000000000000000  -> runtime delivers wei (UI converts GEN -> wei)
Throwaway dev tooling; not part of the product contracts.
"""

from genlayer import *


class Contract(gl.Contract):
    last_value: u256
    call_count: u256

    def __init__(self):
        self.last_value = 0
        self.call_count = 0

    @gl.public.write.payable
    def probe(self) -> None:
        self.last_value = gl.message.value
        self.call_count += 1

    @gl.public.view
    def get_last_value(self) -> u256:
        return self.last_value

    @gl.public.view
    def get_call_count(self) -> u256:
        return self.call_count
