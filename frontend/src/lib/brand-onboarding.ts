import { CORE_ADDRESS, REGISTRY_ADDRESS } from "../config/contracts.ts";

export const GEN = 10n ** 18n;

export interface WriteIntent {
  address: string;
  functionName: string;
  args: unknown[];
  value: bigint;
}

export function registrationProblem(
  name: string,
  domainsCsv: string,
  scopeNote: string,
): string | null {
  const nameLength = name.trim().length;
  if (nameLength < 2 || nameLength > 64) return "Brand name must be 2–64 characters.";

  const domains = domainsCsv.split(",").filter((domain) => domain.trim().length > 0);
  if (domains.length < 1 || domains.length > 5) {
    return "Enter 1–5 official domains, separated by commas.";
  }

  if (scopeNote.length > 500) return "Scope note must be 500 characters or fewer.";
  return null;
}

export function registerBrandIntent(
  name: string,
  domainsCsv: string,
  scopeNote: string,
): WriteIntent {
  return {
    address: REGISTRY_ADDRESS,
    functionName: "register_brand",
    args: [name, domainsCsv, scopeNote],
    value: 0n,
  };
}

export function fundPoolIntent(brandId: number, wholeGenAmount: bigint): WriteIntent {
  return {
    address: CORE_ADDRESS,
    functionName: "fund_pool",
    args: [brandId],
    value: wholeGenAmount * GEN,
  };
}

export function setBountyIntent(brandId: number, wholeGenAmount: bigint): WriteIntent {
  return {
    address: CORE_ADDRESS,
    functionName: "set_bounty",
    args: [brandId, (wholeGenAmount * GEN).toString()],
    value: 0n,
  };
}

export function submitReportIntent(
  brandId: number,
  suspectUrl: string,
  stakeWei: bigint,
): WriteIntent {
  return {
    address: CORE_ADDRESS,
    functionName: "submit_report",
    args: [brandId, suspectUrl],
    value: stakeWei,
  };
}
