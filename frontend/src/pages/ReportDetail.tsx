import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useRead } from "../lib/useRead";
import { getReport } from "../lib/queries";
import { Badge, CopyButton, ErrorBox, Skeleton } from "../components/ui";
import {
  formatDateTime,
  shortAddress,
  signalLabel,
  statusLabel,
  toBigInt,
  toNumber,
  verdictLabel,
  weiToGen,
} from "../lib/format";

/** Statuses in which the appeal window is relevant: CONFIRMED(2), SUSPICIOUS(3), CLEARED(4). */
const APPEALABLE = new Set([2, 3, 4]);

function AppealCountdown({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 10_000);
    return () => window.clearInterval(t);
  }, []);
  const remaining = deadline - now;
  if (remaining <= 0) {
    return <span>Appeal window closed — the report can be settled.</span>;
  }
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return (
    <span>
      Appeal window open — closes in {m}m {s.toString().padStart(2, "0")}s.
    </span>
  );
}

export default function ReportDetail() {
  const { id } = useParams();
  const reportId = Number(id);
  const report = useRead(() => getReport(reportId), [reportId]);

  if (report.error) return <ErrorBox message={report.error} onRetry={report.retry} />;
  if (report.loading || !report.data) return <Skeleton rows={8} />;

  const r = report.data;
  const st = statusLabel(r.status);
  const vd = verdictLabel(r.verdict);
  const statusNum = toNumber(r.status);
  const signals = (r.signals as unknown[]) ?? [];
  const hasVerdict = toNumber(r.verdict) !== 0;

  return (
    <>
      <h1>Report #{toNumber(r.id)}</h1>
      <p className="lead">
        Against <Link to={`/brands/${toNumber(r.brand_id)}`}>brand #{toNumber(r.brand_id)}</Link>
      </p>

      <div className="stack">
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Claim</h2>
          <dl className="kv">
            <dt>Suspect URL</dt>
            <dd>
              {/* Deliberately NOT a link — this URL is a suspected phishing page. */}
              <span className="mono">{String(r.suspect_url)}</span>{" "}
              <CopyButton text={String(r.suspect_url)} label="Copy suspect URL" />
            </dd>
            <dt>Suspect domain</dt>
            <dd className="mono">{String(r.suspect_domain)}</dd>
            <dt>Hunter</dt>
            <dd className="mono">{shortAddress(String(r.hunter))}</dd>
            <dt>Stake</dt>
            <dd>{weiToGen(toBigInt(r.stake))}</dd>
            <dt>Bounty at stake</dt>
            <dd>{weiToGen(toBigInt(r.bounty))}</dd>
            <dt>Submitted</dt>
            <dd>{formatDateTime(r.submitted_at)}</dd>
          </dl>
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0 }}>Consensus outcome</h2>
          <dl className="kv">
            <dt>Status</dt>
            <dd>
              <Badge tone={st.tone}>{st.label}</Badge>
            </dd>
            <dt>Verdict</dt>
            <dd>
              <Badge tone={vd.tone}>{vd.label}</Badge>
              {hasVerdict ? <> — confidence {toNumber(r.confidence)}%</> : null}
            </dd>
            {signals.length > 0 ? (
              <>
                <dt>Signals</dt>
                <dd>
                  {signals.map((s) => (
                    <span key={String(s)} className="chip">
                      {signalLabel(s)}
                    </span>
                  ))}
                </dd>
              </>
            ) : null}
            {String(r.reason ?? "").length > 0 ? (
              <>
                <dt>Validator reasoning</dt>
                <dd>{String(r.reason)}</dd>
              </>
            ) : null}
            {toNumber(r.adjudicated_at) !== 0 ? (
              <>
                <dt>Adjudicated</dt>
                <dd>{formatDateTime(r.adjudicated_at)}</dd>
              </>
            ) : null}
            {APPEALABLE.has(statusNum) ? (
              <>
                <dt>Appeal window</dt>
                <dd>
                  <AppealCountdown deadline={toNumber(r.appeal_deadline)} />
                </dd>
              </>
            ) : null}
            {toNumber(r.retry_count) > 0 ? (
              <>
                <dt>Retries used</dt>
                <dd>{toNumber(r.retry_count)} of 1</dd>
              </>
            ) : null}
          </dl>
        </section>
      </div>
    </>
  );
}
