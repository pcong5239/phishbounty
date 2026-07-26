const GEN = 10n ** 18n;

/** Wei (bigint | numeric string | number) -> exact GEN string, no floats. */
export function weiToGen(value: bigint | string | number | undefined | null): string {
  if (value === undefined || value === null) return "—";
  const wei = BigInt(value);
  const whole = wei / GEN;
  const frac = wei % GEN;
  if (frac === 0n) return `${whole} GEN`;
  const fracStr = frac.toString().padStart(18, "0").replace(/0+$/, "");
  return `${whole}.${fracStr} GEN`;
}

export function shortAddress(addr: string | undefined | null): string {
  if (!addr) return "—";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function toBigInt(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" || typeof value === "string") return BigInt(value);
  return 0n;
}

export function toNumber(value: unknown): number {
  return Number(toBigInt(value));
}

/** Unix seconds -> "3m ago" style humanized string. */
export function timeAgo(unixSeconds: unknown): string {
  const ts = toNumber(unixSeconds);
  if (!ts) return "—";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 0) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function formatDateTime(unixSeconds: unknown): string {
  const ts = toNumber(unixSeconds);
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString();
}

// --- Enum labels (SPEC §5) ---

export type BadgeTone = "ok" | "danger" | "warn" | "neutral";

export function statusLabel(status: unknown): { label: string; tone: BadgeTone } {
  switch (toNumber(status)) {
    case 1:
      return { label: "Submitted", tone: "neutral" };
    case 2:
      return { label: "Confirmed — appealable", tone: "danger" };
    case 3:
      return { label: "Suspicious — awaiting settlement", tone: "warn" };
    case 4:
      return { label: "Cleared — appealable", tone: "ok" };
    case 5:
      return { label: "Undetermined — retry pending", tone: "neutral" };
    case 6:
      return { label: "Under appeal", tone: "warn" };
    case 7:
      return { label: "Final: confirmed phishing", tone: "danger" };
    case 8:
      return { label: "Final: cleared", tone: "ok" };
    case 9:
      return { label: "Withdrawn — stake refunded", tone: "neutral" };
    default:
      return { label: `Unknown (${String(status)})`, tone: "neutral" };
  }
}

export function verdictLabel(verdict: unknown): { label: string; tone: BadgeTone } {
  switch (toNumber(verdict)) {
    case 1:
      return { label: "Confirmed phishing", tone: "danger" };
    case 2:
      return { label: "Suspicious", tone: "warn" };
    case 3:
      return { label: "Cleared", tone: "ok" };
    default:
      return { label: "No verdict yet", tone: "neutral" };
  }
}

const SIGNAL_LABELS: Record<number, string> = {
  1: "Brand name mimicry",
  2: "Logo / visual mimicry",
  3: "Lookalike domain",
  4: "Credential-harvesting form",
  5: "Urgency / scare language",
  6: "Fake support or wallet prompt",
  7: "Cloned layout",
  8: "No impersonation signals observed",
};

export function signalLabel(code: unknown): string {
  return SIGNAL_LABELS[toNumber(code)] ?? `Signal ${String(code)}`;
}

export function domainStateLabel(state: unknown): { label: string; tone: BadgeTone } {
  switch (toNumber(state)) {
    case 1:
      return { label: "Blocked (active threat)", tone: "danger" };
    case 2:
      return { label: "Neutralized (taken down)", tone: "neutral" };
    default:
      return { label: "Not listed", tone: "ok" };
  }
}

export function eventKindLabel(kind: unknown): { label: string; tone: BadgeTone } {
  switch (toNumber(kind)) {
    case 1:
      return { label: "Listed", tone: "danger" };
    case 2:
      return { label: "Neutralized", tone: "neutral" };
    case 3:
      return { label: "Re-listed", tone: "danger" };
    default:
      return { label: `Event ${String(kind)}`, tone: "neutral" };
  }
}
