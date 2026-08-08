import { useLayoutEffect, useRef } from "react";
import { useWallet } from "../lib/wallet";
import { wrappedFocusTarget } from "../lib/wallet-providers";

const FOCUSABLE = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

export function WalletChooser() {
  const { chooserOpen, closeChooser, wallets, chooseWallet, connecting, error } = useWallet();
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!chooserOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const shell = document.getElementById("app-shell");
    if (shell) shell.inert = true;
    closeRef.current?.focus();
    return () => {
      if (shell) shell.inert = false;
      const restoreTarget = previousFocus?.isConnected
        ? previousFocus
        : document.querySelector<HTMLElement>("[data-wallet-control]");
      restoreTarget?.focus();
    };
  }, [chooserOpen, closeChooser]);

  if (!chooserOpen) return null;

  return (
    <div
      className="wallet-dialog-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) closeChooser();
      }}
    >
      <section
        ref={dialogRef}
        className="wallet-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-dialog-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            closeChooser();
            return;
          }
          if (event.key !== "Tab") return;
          const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
          const target = wrappedFocusTarget(
            focusable,
            document.activeElement instanceof HTMLElement ? document.activeElement : null,
            event.shiftKey,
          );
          if (target) {
            event.preventDefault();
            target.focus();
          }
        }}
      >
        <div className="wallet-dialog-heading">
          <h2 id="wallet-dialog-title">Choose a wallet</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={closeChooser}
            aria-label="Close wallet chooser"
          >
            Close
          </button>
        </div>
        {error ? (
          <div role="alert" className="errorbox">
            {error}
          </div>
        ) : null}
        {wallets.length > 0 ? (
          <div className="stack">
            {wallets.map((wallet) => (
              <button
                type="button"
                className="wallet-choice"
                key={wallet.info.uuid}
                disabled={connecting}
                onClick={() => void chooseWallet(wallet.info.uuid)}
              >
                <span>{wallet.info.name}</span>
                <span className="tile-label">{wallet.info.rdns}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="lead">No compatible injected browser wallet was detected.</p>
        )}
      </section>
    </div>
  );
}
