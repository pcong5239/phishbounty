import { useState } from "react";
import type { ReactNode } from "react";
import { useWallet } from "../lib/wallet";
import { sendWrite } from "../lib/writes";
import type { TxProgress } from "../lib/writes";

const STAGE_COPY: Record<string, string> = {
  signing: "1 of 3 · Awaiting wallet signature",
  pending: "2 of 3 · Validators proposing and voting",
  consensus: "3 of 3 · Finalized — verifying execution result",
};

/**
 * Runs one contract write and reports real consensus progress. `onDone` fires
 * only after FINALIZED + SUCCESS, so callers never optimistically update state.
 */
export function TxAction({
  label,
  address,
  functionName,
  args,
  value = 0n,
  disabled,
  disabledReason,
  onDone,
  children,
}: {
  label: string;
  address: string;
  functionName: string;
  args: unknown[];
  value?: bigint;
  disabled?: boolean;
  disabledReason?: string;
  onDone?: () => void;
  children?: ReactNode;
}) {
  const { address: account, connect, hasProvider } = useWallet();
  const [progress, setProgress] = useState<TxProgress>({ stage: "idle" });

  const busy =
    progress.stage === "signing" ||
    progress.stage === "pending" ||
    progress.stage === "consensus";

  async function run() {
    if (!account) {
      await connect();
      return;
    }
    try {
      await sendWrite(account, address, functionName, args, value, setProgress);
      onDone?.();
    } catch {
      // sendWrite already pushed the error stage into progress state.
    }
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      {children}
      <div>
        <button
          type="button"
          className="primary"
          onClick={() => void run()}
          disabled={busy || disabled}
        >
          {busy ? "Working…" : account ? label : "Connect wallet to continue"}
        </button>
        {!hasProvider ? (
          <span className="tile-label" style={{ display: "block", marginTop: 8 }}>
            MetaMask required
          </span>
        ) : null}
        {disabled && disabledReason ? (
          <span className="tile-label" style={{ display: "block", marginTop: 4 }}>
            {disabledReason}
          </span>
        ) : null}
      </div>

      {progress.stage !== "idle" ? (
        <div
          role="status"
          aria-live="polite"
          className={progress.stage === "error" ? "errorbox" : "card"}
          style={{ padding: 12 }}
        >
          <div>
            {STAGE_COPY[progress.stage] ??
              (progress.stage === "success" ? "Done · Finalized and executed" : "Failed")}
          </div>
          {progress.message ? (
            <div className="tile-label" style={{ marginTop: 4 }}>
              {progress.message}
            </div>
          ) : null}
          {progress.hash ? (
            <div className="mono tile-label" style={{ marginTop: 4 }}>
              tx {progress.hash}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
