import { useState } from "react";
import type { FormEvent } from "react";
import { useRead } from "../lib/useRead";
import { getDomainHistory, getDomainState, getRecentEvents } from "../lib/queries";
import { Badge, Empty, ErrorBox, Skeleton } from "../components/ui";
import { TxAction } from "../components/TxAction";
import { CORE_ADDRESS } from "../config/contracts";
import {
  domainStateLabel,
  eventKindLabel,
  formatDateTime,
  shortAddress,
  timeAgo,
  toNumber,
} from "../lib/format";

function DomainLookup({ domain }: { domain: string }) {
  const lookup = useRead(async () => {
    const [state, history] = await Promise.all([
      getDomainState(domain),
      getDomainHistory(domain),
    ]);
    return { state, history };
  }, [domain]);

  if (lookup.error) return <ErrorBox message={lookup.error} onRetry={lookup.retry} />;
  if (lookup.loading || !lookup.data) return <Skeleton rows={3} />;

  const st = domainStateLabel(lookup.data.state);
  return (
    <section className="card" aria-live="polite">
      <h2 style={{ marginTop: 0 }}>
        <span className="mono">{domain}</span>
      </h2>
      <p>
        <Badge tone={st.tone}>{st.label}</Badge>
      </p>
      {lookup.data.history.length > 0 ? (
        <ol className="timeline">
          {lookup.data.history.map((ev) => {
            const kind = eventKindLabel(ev.kind);
            return (
              <li key={String(ev.id)}>
                <Badge tone={kind.tone}>{kind.label}</Badge>{" "}
                by <span className="mono">{shortAddress(String(ev.hunter))}</span> via report #
                {toNumber(ev.report_id)} — {formatDateTime(ev.at)}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="lead" style={{ margin: 0 }}>
          This domain has never been listed.
        </p>
      )}

      {toNumber(lookup.data.state) === 1 ? (
        <div style={{ marginTop: 16 }}>
          <TxAction
            label="Re-verify this domain"
            address={CORE_ADDRESS}
            functionName="reverify"
            args={[domain]}
            onDone={lookup.retry}
          >
            <p className="lead" style={{ margin: 0 }}>
              Re-verification asks validators whether the page is still impersonating. If it is
              gone or now benign, the domain is marked neutralized. Available once the cooldown
              since the last event has elapsed.
            </p>
          </TxAction>
        </div>
      ) : null}
    </section>
  );
}

export default function Blocklist() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const events = useRead(() => getRecentEvents(20), []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const cleaned = query.trim().toLowerCase();
    setSubmitted(cleaned.length > 0 ? cleaned : null);
  }

  return (
    <>
      <h1>Blocklist</h1>
      <p className="lead">
        Append-only, on-chain log of confirmed impersonation domains. Other contracts can query
        this registry directly. States: <strong>Blocked</strong> (confirmed and live),{" "}
        <strong>Neutralized</strong> (taken down or no longer impersonating),{" "}
        <strong>Re-listed</strong> (came back after neutralization).
      </p>

      <form className="formrow" onSubmit={onSubmit}>
        <div>
          <label htmlFor="domain-search">Check a domain</label>
          <input
            id="domain-search"
            type="search"
            name="domain"
            placeholder="e.g. login-example.com"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <button type="submit" className="primary">
          Look up
        </button>
      </form>

      {submitted ? <DomainLookup domain={submitted} /> : null}

      <h2>Recent events</h2>
      {events.error ? (
        <ErrorBox message={events.error} onRetry={events.retry} />
      ) : events.loading ? (
        <Skeleton rows={4} />
      ) : events.data && events.data.length > 0 ? (
        <table className="data">
          <thead>
            <tr>
              <th>Event</th>
              <th>Domain</th>
              <th>Report</th>
              <th>Hunter</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {events.data.map((ev) => {
              const kind = eventKindLabel(ev.kind);
              return (
                <tr key={String(ev.id)}>
                  <td>
                    <Badge tone={kind.tone}>{kind.label}</Badge>
                  </td>
                  <td className="mono">{String(ev.domain)}</td>
                  <td>#{toNumber(ev.report_id)}</td>
                  <td className="mono">{shortAddress(String(ev.hunter))}</td>
                  <td>{timeAgo(ev.at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <Empty>
          The blocklist is empty. Domains appear here after a report is confirmed by validator
          consensus and settled.
        </Empty>
      )}
    </>
  );
}
