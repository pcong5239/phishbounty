import { readContract } from "./client";
import { toNumber } from "./format";
import {
  BLOCKLIST_ADDRESS,
  CORE_ADDRESS,
  LIST_PAGE_SIZE,
  REGISTRY_ADDRESS,
} from "../config/contracts";

/** Decoded contract dicts arrive with loosely-typed values; format.ts helpers narrow them. */
export type Rec = Record<string, unknown>;

export async function getOverviewCounts(): Promise<{
  brands: number;
  reports: number;
  events: number;
}> {
  const [brands, reports, events] = await Promise.all([
    readContract<unknown>(REGISTRY_ADDRESS, "get_brand_count"),
    readContract<unknown>(CORE_ADDRESS, "get_report_count"),
    readContract<unknown>(BLOCKLIST_ADDRESS, "get_event_count"),
  ]);
  return { brands: toNumber(brands), reports: toNumber(reports), events: toNumber(events) };
}

export function getBrand(id: number): Promise<Rec> {
  return readContract<Rec>(REGISTRY_ADDRESS, "get_brand", [id]);
}

export function getPool(brandId: number): Promise<Rec> {
  return readContract<Rec>(CORE_ADDRESS, "get_pool", [brandId]);
}

export function getReport(id: number): Promise<Rec> {
  return readContract<Rec>(CORE_ADDRESS, "get_report", [id]);
}

/**
 * Newest-first page of ids: [count - offset, ...] down to 1, capped at LIST_PAGE_SIZE.
 * Items are fetched sequentially to stay gentle on the Studionet RPC.
 */
export async function listNewestFirst(
  count: number,
  offset: number,
  fetchOne: (id: number) => Promise<Rec>,
): Promise<Rec[]> {
  const start = count - offset;
  const end = Math.max(1, start - LIST_PAGE_SIZE + 1);
  const items: Rec[] = [];
  for (let id = start; id >= end; id--) {
    items.push(await fetchOne(id));
  }
  return items;
}

export function getRecentEvents(n: number): Promise<Rec[]> {
  return readContract<Rec[]>(BLOCKLIST_ADDRESS, "get_recent_events", [n]);
}

export function getDomainState(domain: string): Promise<unknown> {
  return readContract<unknown>(BLOCKLIST_ADDRESS, "get_domain_state", [domain]);
}

export function getDomainHistory(domain: string): Promise<Rec[]> {
  return readContract<Rec[]>(BLOCKLIST_ADDRESS, "get_domain_history", [domain]);
}

export async function getHunterProfile(address: string): Promise<{
  stats: Rec;
  confirmed: number;
  neutralized: number;
}> {
  const [stats, confirmed, neutralized] = await Promise.all([
    readContract<Rec>(CORE_ADDRESS, "get_hunter_stats", [address]),
    readContract<unknown>(BLOCKLIST_ADDRESS, "get_hunter_confirmed", [address]),
    readContract<unknown>(BLOCKLIST_ADDRESS, "get_hunter_neutralized", [address]),
  ]);
  return { stats, confirmed: toNumber(confirmed), neutralized: toNumber(neutralized) };
}
