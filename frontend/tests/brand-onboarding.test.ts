import assert from "node:assert/strict";
import test from "node:test";
import { CORE_ADDRESS, REGISTRY_ADDRESS } from "../src/config/contracts.ts";
import {
  GEN,
  fundPoolIntent,
  registerBrandIntent,
  registrationProblem,
  setBountyIntent,
  submitReportIntent,
} from "../src/lib/brand-onboarding.ts";

test("new brand can register, fund, configure a bounty, and proceed to reporting", () => {
  const brandId = 2;
  const suspectUrl = "https://suspect.example.net/login";

  assert.deepEqual(registerBrandIntent("Review Brand", "example.org", "Public login pages"), {
    address: REGISTRY_ADDRESS,
    functionName: "register_brand",
    args: ["Review Brand", "example.org", "Public login pages"],
    value: 0n,
  });
  assert.deepEqual(fundPoolIntent(brandId, 5n), {
    address: CORE_ADDRESS,
    functionName: "fund_pool",
    args: [brandId],
    value: 5n * GEN,
  });
  assert.deepEqual(setBountyIntent(brandId, 5n), {
    address: CORE_ADDRESS,
    functionName: "set_bounty",
    args: [brandId, (5n * GEN).toString()],
    value: 0n,
  });
  assert.deepEqual(submitReportIntent(brandId, suspectUrl, 1n * GEN), {
    address: CORE_ADDRESS,
    functionName: "submit_report",
    args: [brandId, suspectUrl],
    value: 1n * GEN,
  });
  assert.equal(typeof fundPoolIntent(brandId, 5n).value, "bigint");
  assert.equal(typeof submitReportIntent(brandId, suspectUrl, 1n * GEN).value, "bigint");
});

test("registration validation mirrors the contract's basic bounds", () => {
  assert.equal(registrationProblem("Review Brand", "example.org", "Scope"), null);
  assert.match(registrationProblem("A", "example.org", "Scope") ?? "", /2–64/);
  assert.match(registrationProblem("A".repeat(65), "example.org", "Scope") ?? "", /2–64/);
  assert.match(registrationProblem("Review Brand", "", "Scope") ?? "", /1–5/);
  assert.match(
    registrationProblem("Review Brand", "a.com,b.com,c.com,d.com,e.com,f.com", "Scope") ?? "",
    /1–5/,
  );
  assert.match(registrationProblem("Review Brand", "example.org", "S".repeat(501)) ?? "", /500/);
});
