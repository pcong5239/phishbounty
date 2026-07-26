import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useRead } from "../lib/useRead";
import { getBrand, getReport } from "../lib/queries";
import { Badge, CopyButton, ErrorBox, Skeleton } from "../components/ui";
import { TxAction } from "../components/TxAction";
import { useWallet } from "../lib/wallet";
import { CORE_ADDRESS } from "../config/contracts";
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

/** Only CONFIRMED(2) and CLEARED(4) can be appealed; SUSPICIOUS(3) goes straight to settlement. */
const APPEALABLE = new Set([2, 4]);
/** Statuses whose deadline gates settle(): CONFIRMED(2), SUSPICIOUS(3), CLEARED(4). */
const AWAITING_SETTLEMENT = new Set([2, 3, 4]);

function DeadlineCountdown({ deadline, appealable }: { deadline: number; appealable: boolean }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 10_000);
    return () => window.clearInterval(t);
  }, []);
  const remaining = deadline - now;
  if (remaining <= 0) {
    return (
      <span>
        {appealable
          ? "Appeal window closed — the report can be settled."
          : "Settlement window open — the report can be settled."}
      </span>
    );
  }
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const clock = `${m}m ${s.toString().padStart(2, "0")}s`;
  return (
    <span>
      {appealable
        ? `Appeal window open — closes in ${clock}.`
        : `Settlement delay — settle unlocks in ${clock}.`}
    </span>
  );
}

export default function ReportDetail() {
  const { id } = useParams();
  const reportId = Number(id);
  const { address: account } = useWallet();
  const report = useRead(() => getReport(reportId), [reportId]);
  const brandId = report.data ? toNumber(report.data.brand_id) : 0;
  const brand = useRead(
    () => (brandId === 0 ? Promise.resolve(null) : getBrand(brandId)),
    [brandId],
  );

  if (report.error) return <ErrorBox message={report.error} onRetry={report.retry} />;
  if (report.loading || !report.data) return <Skeleton rows={8} />;

  const r = report.data;
  const st = statusLabel(r.status);
  const vd = verdictLabel(r.verdict);
  const statusNum = toNumber(r.status);
  const signals = (r.signals as unknown[]) ?? [];
  const hasVerdict = toNumber(r.verdict) !== 0;
  const nowSec = Math.floor(Date.now() / 1000);
  const deadlinePassed = nowSec >= toNumber(r.appeal_deadline);
  const isHunter =
    account !== null && String(r.hunter).toLowerCase() === String(account).toLowerCase();
  const isBrandAdmin =
    account !== null &&
    brand.data !== null &&
    String(brand.data?.admin ?? "").toLowerCase() === String(account).toLowerCase();
  // appeal() accepts the brand admin against CONFIRMED and the hunter against CLEARED.
  const canAppeal =
    (statusNum === 2 && isBrandAdmin) || (statusNum === 4 && isHunter);
  const appealStake = toBigInt(r.stake) * 2n;

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
            {AWAITING_SETTLEMENT.has(statusNum) ? (
              <>
                <dt>{APPEALABLE.has(statusNum) ? "Appeal window" : "Settlement"}</dt>
                <dd>
                  <DeadlineCountdown
                    deadline={toNumber(r.appeal_deadline)}
                    appealable={APPEALABLE.has(statusNum)}
                  />
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

        <section className="card">
          <h2 style={{ marginTop: 0 }}>Actions</h2>
          {statusNum === 1 || (statusNum === 5 && toNumber(r.retry_count) === 1) ? (
            <TxAction
              label="Run adjudication"
              address={CORE_ADDRESS}
              functionName="adjudicate"
              args={[reportId]}
              onDone={report.retry}
            >
              <p className="lead" style={{ margin: 0 }}>
                Anyone can trigger adjudication. Validators independently render the suspect page
                and the official brand page, then vote on the verdict. This takes a few minutes.
              </p>
            </TxAction>
          ) : null}

          {statusNum === 6 ? (
            <TxAction
              label="Run appeal review"
              address={CORE_ADDRESS}
              functionName="adjudicate"
              args={[reportId]}
              onDone={report.retry}
            >
              <p className="lead" style={{ margin: 0 }}>
                This report is under appeal. The re-review runs with an adversarial skeptic prompt
                and produces a final verdict.
              </p>
            </TxAction>
          ) : null}

          {canAppeal && !deadlinePassed ? (
            <div style={{ marginTop: 16 }}>
              <TxAction
                label={`Appeal — stake ${weiToGen(appealStake)}`}
                address={CORE_ADDRESS}
                functionName="appeal"
                args={[reportId]}
                value={appealStake}
                onDone={report.retry}
              >
                <p className="lead" style={{ margin: 0 }}>
                  Appealing costs twice the original stake. If the appeal review agrees with you,
                  you recover it; if not, it goes to the other party.
                </p>
              </TxAction>
            </div>
          ) : null}

          {AWAITING_SETTLEMENT.has(statusNum) ? (
            <div style={{ marginTop: 16 }}>
              <TxAction
                label="Settle report"
                address={CORE_ADDRESS}
                functionName="settle"
                args={[reportId]}
                disabled={!deadlinePassed}
                disabledReason="Window still open"
                onDone={report.retry}
              >
                <p className="lead" style={{ margin: 0 }}>
                  Settlement is permissionless and moves the funds: bounty to the hunter on a
                  confirmed report, stake to the brand pool on a cleared one.
                </p>
              </TxAction>
            </div>
          ) : null}

          {statusNum === 7 || statusNum === 8 || statusNum === 9 ? (
            <p className="lead" style={{ margin: 0 }}>
              This report is final. No further actions are available.
            </p>
          ) : null}
        </section>
      </div>
    </>
  );
}
