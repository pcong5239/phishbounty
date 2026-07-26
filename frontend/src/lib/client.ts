import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

// Read-only client: no account needed for view calls.
export const client = createClient({ chain: studionet });

type Hex = `0x${string}`;

/**
 * Thin wrapper over client.readContract that normalizes the decoded result:
 * genlayer-js may decode contract dicts as Map instances — convert to plain
 * objects recursively so pages can use ordinary property access.
 */
export async function readContract<T>(
  address: string,
  functionName: string,
  args: unknown[] = [],
): Promise<T> {
  const raw = await client.readContract({
    address: address as Hex,
    functionName,
    args: args as never[],
  });
  return normalize(raw) as T;
}

function normalize(value: unknown): unknown {
  if (value instanceof Map) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of value.entries()) {
      out[String(k)] = normalize(v);
    }
    return out;
  }
  if (Array.isArray(value)) {
    return value.map(normalize);
  }
  if (value instanceof Uint8Array) {
    return "0x" + Array.from(value, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return value;
}
