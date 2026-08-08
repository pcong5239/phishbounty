import type { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const LEGACY_UUID = "legacy-window-ethereum";

export type WalletProvider = NonNullable<
  NonNullable<Parameters<typeof createClient>[0]>["provider"]
>;

export interface WalletInfo {
  uuid: string;
  name: string;
  rdns: string;
}

export interface WalletOption {
  info: WalletInfo;
  provider: WalletProvider;
}

export interface Eip6963ProviderDetail {
  info: WalletInfo & { icon?: string };
  provider: WalletProvider;
}

export function legacyWallet(provider: WalletProvider): WalletOption {
  return {
    info: {
      uuid: LEGACY_UUID,
      name: "Browser wallet",
      rdns: "legacy.window.ethereum",
    },
    provider,
  };
}

/** Keep one entry per provider; a named EIP-6963 announcement replaces its legacy fallback. */
export function upsertWallet(wallets: WalletOption[], detail: WalletOption): WalletOption[] {
  const candidates = detail.info.uuid === LEGACY_UUID
    ? wallets
    : wallets.filter((wallet) => wallet.info.uuid !== LEGACY_UUID);
  const existing = candidates.findIndex(
    (wallet) => wallet.info.uuid === detail.info.uuid || wallet.provider === detail.provider,
  );
  if (existing === -1) return [...candidates, detail];
  const next = [...candidates];
  next[existing] = detail;
  return next;
}

export function wrappedFocusTarget<T>(
  focusable: T[],
  active: T | null,
  reverse: boolean,
): T | null {
  if (focusable.length === 0) return null;
  const index = active === null ? -1 : focusable.indexOf(active);
  if (reverse && index <= 0) return focusable[focusable.length - 1];
  if (!reverse && (index === -1 || index === focusable.length - 1)) return focusable[0];
  return null;
}

export async function switchToStudionet(provider: WalletProvider): Promise<void> {
  const chainId = `0x${studionet.id.toString(16)}`;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
    if (code !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId,
          chainName: studionet.name,
          rpcUrls: [...studionet.rpcUrls.default.http],
          nativeCurrency: studionet.nativeCurrency,
          blockExplorerUrls: studionet.blockExplorers
            ? [studionet.blockExplorers.default.url]
            : undefined,
        },
      ],
    });
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  }
}
