// Live read verification against the Studionet dev deployment.
// Runs the same call shapes the pages use. Usage: node scripts/verify-reads.mjs
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const REGISTRY = "0xe34C583C04ccfa33C44A69010a02EB1A85071EF2";
const BLOCKLIST = "0x8a50d35df4Fb0599d6613aa35286BcE56a46F05A";
const CORE = "0x584890C0C49EA8dA61316b5512559063c0DE9c14";

const client = createClient({ chain: studionet });

async function read(address, functionName, args = []) {
  const result = await client.readContract({ address, functionName, args });
  return result;
}

function show(label, value) {
  console.log(
    label.padEnd(28),
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
}

show("registry.get_brand_count", await read(REGISTRY, "get_brand_count"));
show("registry.get_brand(1)", await read(REGISTRY, "get_brand", [1]));
show("core.get_report_count", await read(CORE, "get_report_count"));
show("core.get_report(1)", await read(CORE, "get_report", [1]));
show("core.get_pool(1)", await read(CORE, "get_pool", [1]));
show("blocklist.get_event_count", await read(BLOCKLIST, "get_event_count"));
show("blocklist.get_domain_state", await read(BLOCKLIST, "get_domain_state", ["www.wikipedia.org"]));
console.log("\nAll live reads completed.");
