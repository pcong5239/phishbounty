// Live read verification against the Studionet dev deployment.
// Runs the same call shapes the pages use. Usage: node scripts/verify-reads.mjs
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const REGISTRY = "0xe34C583C04ccfa33C44A69010a02EB1A85071EF2";
const BLOCKLIST = "0x1B7F3542fb002D35de92AC63890cbc5a45B7C9Eb";
const CORE = "0x73eb224D4625aa5479e209C73A879E1AF0114AB0";
const VERIFIED_DOMAIN = "phishbounty.vercel.app";

const client = createClient({ chain: studionet });

async function read(address, functionName, args = []) {
  const result = await client.readContract({ address, functionName, args });
  return result;
}

function show(label, value) {
  console.log(
    label.padEnd(38),
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
}

show("registry.get_brand_count", await read(REGISTRY, "get_brand_count"));
show("registry.get_brand(1)", await read(REGISTRY, "get_brand", [1]));
show("core.get_report_count", await read(CORE, "get_report_count"));
show("core.get_report(1)", await read(CORE, "get_report", [1]));
show("core.get_pool(1)", await read(CORE, "get_pool", [1]));
show("blocklist.get_writer", await read(BLOCKLIST, "get_writer"));
show("blocklist.get_event_count", await read(BLOCKLIST, "get_event_count"));
show("blocklist.get_domain_state", await read(BLOCKLIST, "get_domain_state", [VERIFIED_DOMAIN]));
show("blocklist.get_domain_history", await read(BLOCKLIST, "get_domain_history", [VERIFIED_DOMAIN]));
console.log("\nAll live reads completed.");
