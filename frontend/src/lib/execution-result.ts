import { ExecutionResult } from "genlayer-js/types";

export function executionFailure(
  receipt: Record<string, unknown>,
): string | null {
  const result = receipt.txExecutionResultName;

  if (result === ExecutionResult.FINISHED_WITH_RETURN) {
    return null;
  }

  if (result === ExecutionResult.FINISHED_WITH_ERROR) {
    return readableError(receipt);
  }

  if (result === ExecutionResult.NOT_VOTED) {
    return "Transaction finalized but execution result is NOT_VOTED.";
  }

  if (result === undefined || result === null) {
    return "Transaction finalized but execution result is missing.";
  }

  return "Transaction finalized with an unknown execution result.";
}

function readableError(receipt: Record<string, unknown>): string {
  const raw = JSON.stringify(receipt);
  const match = raw.match(/ERR_[A-Z_0-9]+/);
  if (match) return `Contract rejected the call: ${match[0]}`;
  return "Transaction finalized but execution failed.";
}
