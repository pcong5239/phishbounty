import { TransactionStatus } from "genlayer-js/types";
import type { TransactionHash } from "genlayer-js/types";

type FinalityClient = {
  waitForTransactionReceipt(args: {
    hash: TransactionHash;
    status: TransactionStatus;
    interval: number;
    retries: number;
  }): Promise<unknown>;
};

const POLL_INTERVAL_MS = 3_000;
const FINALITY_TIMEOUT_MS = 30 * 60 * 1_000;

export function finalityDeadline(now = Date.now()): number {
  return now + FINALITY_TIMEOUT_MS;
}

function remainingRetries(deadline: number, now: number): number {
  if (now >= deadline) throw new Error("Timed out waiting for transaction finality.");
  return Math.floor((deadline - now) / POLL_INTERVAL_MS);
}

function waitForReceipt(
  client: FinalityClient,
  hash: string,
  status: TransactionStatus,
  deadline: number,
  now: number,
): Promise<unknown> {
  return client.waitForTransactionReceipt({
    hash: hash as TransactionHash,
    status,
    interval: POLL_INTERVAL_MS,
    retries: remainingRetries(deadline, now),
  });
}

export async function waitForConsensusReceipt(
  client: FinalityClient,
  hash: string,
  deadline: number,
  now = Date.now(),
): Promise<Record<string, unknown>> {
  const receipt = (await waitForReceipt(
    client,
    hash,
    TransactionStatus.ACCEPTED,
    deadline,
    now,
  )) as Record<string, unknown>;
  const status = receipt.status_name ?? receipt.statusName;
  if (status !== TransactionStatus.ACCEPTED && status !== TransactionStatus.FINALIZED) {
    throw new Error(
      typeof status === "string"
        ? `Transaction ended with status ${status}.`
        : "Transaction reached an unknown decided status.",
    );
  }
  return receipt;
}

export function waitForFinalizedReceipt(
  client: FinalityClient,
  hash: string,
  deadline: number,
  now = Date.now(),
): Promise<unknown> {
  return waitForReceipt(client, hash, TransactionStatus.FINALIZED, deadline, now);
}

export async function withReportedFailure<T>(
  action: () => Promise<T>,
  report: (message: string) => void,
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    report(error instanceof Error ? error.message : String(error));
    throw error;
  }
}
