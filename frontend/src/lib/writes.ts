import { TransactionStatus } from "genlayer-js/types";
import { writeClient } from "./wallet";

type Hex = `0x${string}`;

export type TxStage =
  | "idle"
  | "signing"
  | "pending"
  | "consensus"
  | "success"
  | "error";

export interface TxProgress {
  stage: TxStage;
  hash?: string;
  message?: string;
}

/**
 * Submit a write and resolve only when the transaction is FINALIZED *and* its
 * execution result is SUCCESS. A finalized transaction can still carry an
 * execution error, so both must be checked before any UI state advances.
 */
export async function sendWrite(
  account: Hex,
  address: string,
  functionName: string,
  args: unknown[],
  value: bigint,
  onProgress: (p: TxProgress) => void,
): Promise<{ hash: string }> {
  const client = writeClient(account);

  onProgress({ stage: "signing", message: "Waiting for wallet signature…" });
  const hash = (await client.writeContract({
    address: address as Hex,
    functionName,
    args: args as never[],
    value,
  })) as unknown as string;

  onProgress({
    stage: "pending",
    hash,
    message: "Transaction submitted. Validators are proposing and voting…",
  });

  const receipt = (await client.waitForTransactionReceipt({
    hash: hash as never,
    status: TransactionStatus.FINALIZED,
  })) as unknown as Record<string, unknown>;

  onProgress({ stage: "consensus", hash, message: "Finalized. Verifying execution result…" });

  const failure = executionFailure(receipt);
  if (failure) {
    onProgress({ stage: "error", hash, message: failure });
    throw new Error(failure);
  }

  onProgress({ stage: "success", hash, message: "Finalized and executed successfully." });
  return { hash };
}

/**
 * Returns a human-readable failure message when the finalized receipt reports an
 * execution error, or null when the execution succeeded. Receipt shapes vary
 * across genlayer-js versions, so several known locations are inspected.
 */
function executionFailure(receipt: Record<string, unknown>): string | null {
  const candidates: unknown[] = [
    receipt.execution_result,
    receipt.executionResult,
    (receipt.consensus_data as Record<string, unknown> | undefined)?.leader_receipt,
    receipt.status,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const upper = candidate.toUpperCase();
      if (upper === "ERROR" || upper === "REVERTED") {
        return readableError(receipt);
      }
    }
    if (candidate && typeof candidate === "object") {
      const nested = candidate as Record<string, unknown>;
      const result = nested.execution_result ?? nested.executionResult;
      if (typeof result === "string" && result.toUpperCase() === "ERROR") {
        return readableError(receipt);
      }
    }
  }
  return null;
}

function readableError(receipt: Record<string, unknown>): string {
  const raw = JSON.stringify(receipt);
  const match = raw.match(/ERR_[A-Z_0-9]+/);
  if (match) return `Contract rejected the call: ${match[0]}`;
  return "Transaction finalized but execution failed.";
}
