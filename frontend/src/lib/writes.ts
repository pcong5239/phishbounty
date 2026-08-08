import { TransactionStatus } from "genlayer-js/types";
import { executionFailure } from "./execution-result";
import { writeClient } from "./wallet";
import type { WalletProvider } from "./wallet-providers";

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
  provider: WalletProvider,
  onProgress: (p: TxProgress) => void,
): Promise<{ hash: string }> {
  const client = writeClient(account, provider);

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
