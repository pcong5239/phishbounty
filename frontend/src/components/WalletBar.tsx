import { useWallet } from "../lib/wallet";
import { shortAddress } from "../lib/format";

export function WalletBar() {
  const {
    address,
    openChooser,
    disconnect,
    connecting,
    error,
    hasProvider,
    selectedWalletName,
  } = useWallet();

  return (
    <div style={{ marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
      {address ? (
        <>
          <div className="tile-label">
            Connected wallet{selectedWalletName ? ` · ${selectedWalletName}` : ""}
          </div>
          <div className="mono" style={{ margin: "2px 0 8px" }}>
            {shortAddress(address)}
          </div>
          <button type="button" data-wallet-control onClick={disconnect}>
            Disconnect
          </button>
        </>
      ) : (
        <>
          <div className="tile-label" style={{ marginBottom: 6 }}>
            Read-only. Connect to file reports or fund pools.
          </div>
          <button
            type="button"
            className="primary"
            data-wallet-control
            onClick={openChooser}
            disabled={connecting}
          >
            {connecting ? "Connecting…" : "Choose wallet"}
          </button>
          {!hasProvider ? (
            <div className="tile-label" style={{ marginTop: 6 }}>
              No injected browser wallet detected.
            </div>
          ) : null}
        </>
      )}
      {error ? (
        <div className="tile-label" style={{ color: "var(--danger)", marginTop: 6 }} role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}
