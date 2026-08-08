import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import type { Eip6963ProviderDetail, WalletOption, WalletProvider } from "./wallet-providers";
import { legacyWallet, switchToStudionet, upsertWallet } from "./wallet-providers";

type Hex = `0x${string}`;

declare global {
  interface Window {
    ethereum?: WalletProvider;
  }
}

interface WalletState {
  address: Hex | null;
  connecting: boolean;
  error: string | null;
  hasProvider: boolean;
  provider: WalletProvider | null;
  wallets: WalletOption[];
  selectedWalletName: string | null;
  chooserOpen: boolean;
  openChooser: () => void;
  closeChooser: () => void;
  chooseWallet: (uuid: string) => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<Hex | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<WalletProvider | null>(null);
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [selectedWalletName, setSelectedWalletName] = useState<string | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  const hasProvider = wallets.length > 0;

  const chooseWallet = useCallback(async (uuid: string) => {
    const selected = wallets.find((wallet) => wallet.info.uuid === uuid);
    if (!selected) {
      setError("The selected wallet is no longer available.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const accounts = (await selected.provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      const first = accounts?.[0];
      if (!first) throw new Error("Wallet returned no accounts.");

      await switchToStudionet(selected.provider);
      setProvider(selected.provider);
      setSelectedWalletName(selected.info.name);
      setAddress(first as Hex);
      setChooserOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setConnecting(false);
    }
  }, [wallets]);

  const openChooser = useCallback(() => {
    setError(null);
    setChooserOpen(true);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
  }, []);
  const closeChooser = useCallback(() => setChooserOpen(false), []);
  const disconnect = useCallback(() => {
    setAddress(null);
    setProvider(null);
    setSelectedWalletName(null);
  }, []);

  useEffect(() => {
    let announced = false;
    const announce = (event: Event) => {
      const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail;
      if (
        !detail?.provider ||
        typeof detail.info?.uuid !== "string" ||
        typeof detail.info.name !== "string" ||
        typeof detail.info.rdns !== "string"
      ) return;
      announced = true;
      setWallets((current) => upsertWallet(current, detail));
    };
    window.addEventListener("eip6963:announceProvider", announce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const fallback = window.setTimeout(() => {
      if (!announced && window.ethereum) {
        setWallets((current) => current.length > 0 ? current : [legacyWallet(window.ethereum!)]);
      }
    }, 100);
    return () => {
      window.clearTimeout(fallback);
      window.removeEventListener("eip6963:announceProvider", announce);
    };
  }, []);

  useEffect(() => {
    if (!provider?.on) return;
    const handler = (...args: unknown[]) => {
      const accounts = args[0] as string[] | undefined;
      setAddress(accounts && accounts.length > 0 ? (accounts[0] as Hex) : null);
    };
    provider.on("accountsChanged", handler);
    return () => provider.removeListener?.("accountsChanged", handler);
  }, [provider]);

  const value = useMemo(
    () => ({
      address,
      connecting,
      error,
      hasProvider,
      provider,
      wallets,
      selectedWalletName,
      chooserOpen,
      openChooser,
      closeChooser,
      chooseWallet,
      disconnect,
    }),
    [
      address,
      connecting,
      error,
      hasProvider,
      provider,
      wallets,
      selectedWalletName,
      chooserOpen,
      openChooser,
      closeChooser,
      chooseWallet,
      disconnect,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}

/** Write-capable client bound to the connected account. */
export function writeClient(account: Hex, provider: WalletProvider) {
  return createClient({ chain: studionet, account, provider });
}
