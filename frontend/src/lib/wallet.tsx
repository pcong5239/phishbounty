import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { CHAIN } from "../config/contracts";

type Hex = `0x${string}`;

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

interface WalletState {
  address: Hex | null;
  connecting: boolean;
  error: string | null;
  hasProvider: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<Hex | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasProvider = typeof window !== "undefined" && Boolean(window.ethereum);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError("No wallet extension detected. Install MetaMask to submit transactions.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      const first = accounts?.[0];
      if (!first) throw new Error("Wallet returned no accounts.");
      // Ask genlayer-js to switch/add the target network before any write.
      const client = createClient({ chain: studionet, account: first as Hex });
      await client.connect(CHAIN);
      setAddress(first as Hex);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => setAddress(null), []);

  useEffect(() => {
    const provider = window.ethereum;
    if (!provider?.on) return;
    const handler = (...args: unknown[]) => {
      const accounts = args[0] as string[] | undefined;
      setAddress(accounts && accounts.length > 0 ? (accounts[0] as Hex) : null);
    };
    provider.on("accountsChanged", handler);
    return () => provider.removeListener?.("accountsChanged", handler);
  }, []);

  const value = useMemo(
    () => ({ address, connecting, error, hasProvider, connect, disconnect }),
    [address, connecting, error, hasProvider, connect, disconnect],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}

/** Write-capable client bound to the connected account. */
export function writeClient(account: Hex) {
  return createClient({ chain: studionet, account });
}
