import { useState } from "react";
import type { FormEvent } from "react";
import { useRead } from "../lib/useRead";
import { getHunterProfile } from "../lib/queries";
import { ErrorBox, Skeleton, StatTile } from "../components/ui";
import { toNumber } from "../lib/format";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function HunterProfile({ address }: { address: string }) {
  const profile = useRead(() => getHunterProfile(address), [address]);

  if (profile.error) return <ErrorBox message={profile.error} onRetry={profile.retry} />;
  if (profile.loading || !profile.data) return <Skeleton rows={3} />;

  const { stats, confirmed, neutralized } = profile.data;
  return (
    <section aria-live="polite">
      <h2>
        <span className="mono">{address}</span>
      </h2>
      <div className="tiles">
        <StatTile label="Open reports" value={toNumber(stats.open)} />
        <StatTile label="Confirmed (bounties won)" value={toNumber(stats.confirmed)} />
        <StatTile label="Cleared (stake slashed)" value={toNumber(stats.cleared)} />
        <StatTile label="Suspicious (stake returned)" value={toNumber(stats.suspicious)} />
        <StatTile label="Blocklist entries credited" value={confirmed} />
        <StatTile label="Takedowns neutralized" value={neutralized} />
      </div>
    </section>
  );
}

export default function Hunters() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const cleaned = query.trim();
    if (!ADDRESS_RE.test(cleaned)) {
      setInputError("Enter a full wallet address (0x + 40 hex characters).");
      setSubmitted(null);
      return;
    }
    setInputError(null);
    setSubmitted(cleaned);
  }

  return (
    <>
      <h1>Hunters</h1>
      <p className="lead">
        Hunter reputation is on-chain: bounties won, stakes lost, and takedown credits are all
        derived from settled reports.
      </p>

      <form className="formrow" onSubmit={onSubmit} noValidate>
        <div>
          <label htmlFor="hunter-address">Wallet address</label>
          <input
            id="hunter-address"
            type="text"
            name="address"
            placeholder="0x…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={inputError ? true : undefined}
            aria-describedby={inputError ? "hunter-address-error" : undefined}
          />
          {inputError ? (
            <p id="hunter-address-error" role="alert" style={{ color: "var(--danger)", margin: "4px 0 0" }}>
              {inputError}
            </p>
          ) : null}
        </div>
        <button type="submit" className="primary">
          Look up
        </button>
      </form>

      {submitted ? <HunterProfile address={submitted} /> : null}
    </>
  );
}
