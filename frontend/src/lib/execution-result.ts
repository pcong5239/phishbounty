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
    return studioExecutionFailure(receipt);
  }

  return "Transaction finalized with an unknown execution result.";
}

function studioExecutionFailure(receipt: Record<string, unknown>): string | null {
  if (receipt.status_name !== "FINALIZED" || receipt.result_name !== "MAJORITY_AGREE") {
    return "Transaction finalized without a successful consensus result.";
  }

  const consensus = receipt.consensus_data;
  if (!consensus || typeof consensus !== "object") {
    return "Transaction finalized but execution result is missing.";
  }
  const leaders = (consensus as Record<string, unknown>).leader_receipt;
  const receipts = Array.isArray(leaders) ? leaders : leaders ? [leaders] : [];
  const leader = receipts
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .reverse()
    .find((item) => item.mode === "leader");
  if (!leader) return "Transaction finalized but leader execution result is missing.";

  const leaderResult = leader.result;
  const returned =
    leaderResult &&
    typeof leaderResult === "object" &&
    (leaderResult as Record<string, unknown>).status === "return";
  if (leader.execution_result === "SUCCESS" && returned) return null;
  return readableError(receipt);
}

function readableError(receipt: Record<string, unknown>): string {
  let raw: string;

  try {
    raw =
      JSON.stringify(receipt, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ) ?? "";
  } catch {
    return "Transaction finalized but execution failed.";
  }

  const match = raw.match(/ERR_[A-Z_0-9]+/);
  if (match) return `Contract rejected the call: ${match[0]}`;
  return "Transaction finalized but execution failed.";
}
