import assert from "node:assert/strict";
import test from "node:test";
import { ExecutionResult } from "genlayer-js/types";
import { executionFailure } from "../src/lib/execution-result.ts";

test("executionFailure - A. FINISHED_WITH_RETURN returns null", () => {
  const receipt = {
    status: "FINALIZED",
    txExecutionResultName: ExecutionResult.FINISHED_WITH_RETURN,
  };
  assert.equal(executionFailure(receipt), null);
});

test("executionFailure - B. FINISHED_WITH_ERROR returns a non-null failure", () => {
  const receipt = {
    status: "FINALIZED",
    txExecutionResultName: ExecutionResult.FINISHED_WITH_ERROR,
  };
  const result = executionFailure(receipt);
  assert.notEqual(result, null);
  assert.equal(typeof result, "string");
});

test("executionFailure - C. FINISHED_WITH_ERROR with ERR_SELF_REPORT returns exact message", () => {
  const receipt = {
    status: "FINALIZED",
    txExecutionResultName: ExecutionResult.FINISHED_WITH_ERROR,
    error: "Transaction reverted with ERR_SELF_REPORT in execution",
  };
  assert.equal(
    executionFailure(receipt),
    "Contract rejected the call: ERR_SELF_REPORT",
  );
});

test("executionFailure - D. NOT_VOTED returns a non-null failure", () => {
  const receipt = {
    status: "FINALIZED",
    txExecutionResultName: ExecutionResult.NOT_VOTED,
  };
  const result = executionFailure(receipt);
  assert.notEqual(result, null);
  assert.equal(typeof result, "string");
});

test("executionFailure - E. Missing txExecutionResultName returns a non-null failure", () => {
  const receipt = {
    status: "FINALIZED",
  };
  const result = executionFailure(receipt);
  assert.notEqual(result, null);
  assert.equal(typeof result, "string");
});

test("executionFailure - F. Unknown string returns a non-null failure", () => {
  const receipt = {
    status: "FINALIZED",
    txExecutionResultName: "UNKNOWN_RESULT_NAME",
  };
  const result = executionFailure(receipt);
  assert.notEqual(result, null);
  assert.equal(typeof result, "string");
});

test("executionFailure - G. null and non-string values return non-null failures", () => {
  assert.notEqual(
    executionFailure({ status: "FINALIZED", txExecutionResultName: null }),
    null,
  );
  assert.notEqual(
    executionFailure({ status: "FINALIZED", txExecutionResultName: 12345 }),
    null,
  );
  assert.notEqual(
    executionFailure({ status: "FINALIZED", txExecutionResultName: {} }),
    null,
  );
});

test("regression - rejects finalized receipt with FINISHED_WITH_ERROR", () => {
  const receipt = {
    status: "FINALIZED",
    txExecutionResultName: "FINISHED_WITH_ERROR",
  };
  const failure = executionFailure(receipt);
  assert.notEqual(failure, null);
  assert.equal(typeof failure, "string");
});

test("executionFailure - bigint receipt with ERR code", () => {
  const receipt = {
    status: "FINALIZED",
    txExecutionResultName: ExecutionResult.FINISHED_WITH_ERROR,
    gaslimit: 1n,
    error: "Execution reverted with ERR_SELF_REPORT",
  };
  assert.equal(
    executionFailure(receipt),
    "Contract rejected the call: ERR_SELF_REPORT",
  );
});

test("executionFailure - bigint receipt without ERR code", () => {
  const receipt = {
    status: "FINALIZED",
    txExecutionResultName: ExecutionResult.FINISHED_WITH_ERROR,
    gaslimit: 1n,
  };
  assert.equal(
    executionFailure(receipt),
    "Transaction finalized but execution failed.",
  );
});

test("executionFailure - unserializable circular receipt", () => {
  const receipt: Record<string, unknown> = {
    status: "FINALIZED",
    txExecutionResultName: ExecutionResult.FINISHED_WITH_ERROR,
  };
  receipt.self = receipt;
  assert.equal(
    executionFailure(receipt),
    "Transaction finalized but execution failed.",
  );
});
