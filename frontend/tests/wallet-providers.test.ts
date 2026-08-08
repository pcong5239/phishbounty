import assert from "node:assert/strict";
import test from "node:test";
import type { WalletProvider } from "../src/lib/wallet-providers.ts";
import {
  legacyWallet,
  switchToStudionet,
  upsertWallet,
  wrappedFocusTarget,
} from "../src/lib/wallet-providers.ts";

function provider(): WalletProvider {
  return { request: async () => null } as WalletProvider;
}

test("wallet discovery keeps distinct injected providers", () => {
  const first = { info: { uuid: "one", name: "Wallet One", rdns: "com.one" }, provider: provider() };
  const second = { info: { uuid: "two", name: "Wallet Two", rdns: "com.two" }, provider: provider() };
  assert.deepEqual(upsertWallet(upsertWallet([], first), second), [first, second]);
});

test("an EIP-6963 announcement replaces the same provider's legacy fallback", () => {
  const injected = provider();
  const announced = {
    info: { uuid: "named", name: "Named Wallet", rdns: "com.named" },
    provider: injected,
  };
  assert.deepEqual(upsertWallet([legacyWallet(injected)], announced), [announced]);
});

test("an announced provider removes a distinct ambiguous legacy fallback", () => {
  const fallback = legacyWallet(provider());
  const announced = {
    info: { uuid: "named", name: "Named Wallet", rdns: "com.named" },
    provider: provider(),
  };
  assert.deepEqual(upsertWallet([fallback], announced), [announced]);
});

test("re-announcing the same wallet does not duplicate it", () => {
  const first = { info: { uuid: "same", name: "Wallet", rdns: "com.wallet" }, provider: provider() };
  const updated = { ...first, info: { ...first.info, name: "Wallet Updated" } };
  assert.deepEqual(upsertWallet([first], updated), [updated]);
});

test("wallet network setup adds Studionet only when the wallet reports an unknown chain", async () => {
  const methods: string[] = [];
  let firstSwitch = true;
  const injected = {
    request: async ({ method }: { method: string }) => {
      methods.push(method);
      if (method === "wallet_switchEthereumChain" && firstSwitch) {
        firstSwitch = false;
        throw Object.assign(new Error("unknown chain"), { code: 4902 });
      }
      return null;
    },
  } as WalletProvider;

  await switchToStudionet(injected);
  assert.deepEqual(methods, [
    "wallet_switchEthereumChain",
    "wallet_addEthereumChain",
    "wallet_switchEthereumChain",
  ]);
});

test("wallet network setup does not hide a rejected switch", async () => {
  const rejection = Object.assign(new Error("rejected"), { code: 4001 });
  const injected = {
    request: async () => {
      throw rejection;
    },
  } as WalletProvider;

  await assert.rejects(switchToStudionet(injected), (error) => error === rejection);
});

test("dialog focus wraps only at the first and last controls", () => {
  const first = { id: "first" };
  const middle = { id: "middle" };
  const last = { id: "last" };
  const controls = [first, middle, last];
  assert.equal(wrappedFocusTarget(controls, last, false), first);
  assert.equal(wrappedFocusTarget(controls, first, true), last);
  assert.equal(wrappedFocusTarget(controls, middle, false), null);
});
