import { executionFailure } from "./execution-result";
import {
  finalityDeadline,
  waitForConsensusReceipt,
  waitForFinalizedReceipt,
  withReportedFailure,
} from "./transaction-finality";
import { writeClient } from "./wallet";
import type { WalletProvider } from "./wallet-providers";

type Hex = `0x${string}`;

export type TxStage =
  | "idle"
  | "signing"
  | "pending"
  | "finalizing"
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
  let hash: string | undefined;

  return withReportedFailure(async () => {
    onProgress({ stage: "signing", message: "Waiting for wallet signature…" });
    hash = (await client.writeContract({
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

    const deadline = finalityDeadline();
    await waitForConsensusReceipt(client, hash, deadline);
    onProgress({
      stage: "finalizing",
      hash,
      message: "Consensus reached. Waiting for transaction finality…",
    });

    const receipt = (await waitForFinalizedReceipt(
      client,
      hash,
      deadline,
    )) as Record<string, unknown>;

    const failure = executionFailure(receipt);
    if (failure) throw new Error(failure);

    onProgress({ stage: "success", hash, message: "Finalized and executed successfully." });
    return { hash };
  }, (message) => {
    onProgress({ stage: "error", hash, message });
  });
}
