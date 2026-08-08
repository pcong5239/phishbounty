import assert from "node:assert/strict";
import test from "node:test";
import { TransactionStatus } from "genlayer-js/types";
import {
  finalityDeadline,
  waitForConsensusReceipt,
  waitForFinalizedReceipt,
  withReportedFailure,
} from "../src/lib/transaction-finality.ts";

test("consensus and finality polling outlast the SDK's 30-second default", async () => {
  const calls: Record<string, unknown>[] = [];
  const client = {
    waitForTransactionReceipt: async (args: Record<string, unknown>) => {
      calls.push(args);
      return {
        status_name:
          args.status === TransactionStatus.ACCEPTED
            ? TransactionStatus.ACCEPTED
            : TransactionStatus.FINALIZED,
      };
    },
  };
  const deadline = finalityDeadline(0);

  await waitForConsensusReceipt(client as never, "0xtest", deadline, 0);
  await waitForFinalizedReceipt(client as never, "0xtest", deadline, 900_000);
  assert.deepEqual(calls, [
    {
      hash: "0xtest",
      status: TransactionStatus.ACCEPTED,
      interval: 3_000,
      retries: 600,
    },
    {
      hash: "0xtest",
      status: TransactionStatus.FINALIZED,
      interval: 3_000,
      retries: 300,
    },
  ]);
});

test("non-consensus decided statuses fail before finality polling", async () => {
  for (const status of [
    TransactionStatus.UNDETERMINED,
    TransactionStatus.CANCELED,
    TransactionStatus.VALIDATORS_TIMEOUT,
    TransactionStatus.LEADER_TIMEOUT,
  ]) {
    const client = {
      waitForTransactionReceipt: async () => ({ status_name: status }),
    };
    await assert.rejects(
      waitForConsensusReceipt(client as never, "0xtest", finalityDeadline(0), 0),
      new RegExp(status),
    );
  }
});

test("write failures publish an error before they are rethrown", async () => {
  const failure = new Error("polling failed");
  let reported = "";
  await assert.rejects(
    withReportedFailure(
      async () => Promise.reject(failure),
      (message) => {
        reported = message;
      },
    ),
    (error) => error === failure,
  );
  assert.equal(reported, "polling failed");
});
