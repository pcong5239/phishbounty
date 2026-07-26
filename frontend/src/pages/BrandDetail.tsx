import { useState } from "react";
import { useParams } from "react-router-dom";
import { useRead } from "../lib/useRead";
import { getBrand, getPool } from "../lib/queries";
import { Badge, ErrorBox, Skeleton } from "../components/ui";
import { TxAction } from "../components/TxAction";
import { useWallet } from "../lib/wallet";
import { CORE_ADDRESS } from "../config/contracts";
import { shortAddress, toBigInt, weiToGen } from "../lib/format";

const GEN = 10n ** 18n;

export default function BrandDetail() {
  const { id } = useParams();
  const brandId = Number(id);
  const { address: account } = useWallet();
  const [fundAmount, setFundAmount] = useState("5");
  const [bountyAmount, setBountyAmount] = useState("5");

  const brand = useRead(() => getBrand(brandId), [brandId]);
  const pool = useRead(() => getPool(brandId), [brandId]);

  if (brand.error) return <ErrorBox message={brand.error} onRetry={brand.retry} />;
  if (brand.loading || !brand.data) return <Skeleton rows={6} />;

  const b = brand.data;
  const isAdmin =
    account !== null && String(b.admin).toLowerCase() === String(account).toLowerCase();

  return (
    <>
      <h1>{String(b.name)}</h1>
      <p className="lead">Brand #{String(b.id)}</p>

      <div className="stack">
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Registration</h2>
          <dl className="kv">
            <dt>Official domains</dt>
            <dd>
              {(b.domains as unknown[]).map((d) => (
                <span key={String(d)} className="chip">
                  {String(d)}
                </span>
              ))}
            </dd>
            <dt>Admin</dt>
            <dd className="mono">{shortAddress(String(b.admin))}</dd>
            <dt>Status</dt>
            <dd>
              {b.active ? <Badge tone="ok">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}
            </dd>
            <dt>Scope note</dt>
            <dd>{String(b.scope_note)}</dd>
          </dl>
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0 }}>Bounty pool</h2>
          {pool.error ? (
            <ErrorBox message={pool.error} onRetry={pool.retry} />
          ) : pool.loading || !pool.data ? (
            <Skeleton rows={3} />
          ) : (
            <dl className="kv">
              <dt>Available balance</dt>
              <dd>{weiToGen(toBigInt(pool.data.balance))}</dd>
              <dt>Reserved for open reports</dt>
              <dd>{weiToGen(toBigInt(pool.data.reserved))}</dd>
              <dt>Bounty per confirmed report</dt>
              <dd>
                {toBigInt(pool.data.bounty_amount) === 0n
                  ? "Not configured yet"
                  : weiToGen(toBigInt(pool.data.bounty_amount))}
              </dd>
              <dt>Required hunter stake</dt>
              <dd>
                {toBigInt(pool.data.required_stake) === 0n
                  ? "—"
                  : weiToGen(toBigInt(pool.data.required_stake))}
              </dd>
            </dl>
          )}
          {pool.data && toBigInt(pool.data.balance) === 0n ? (
            <p className="lead" style={{ marginTop: 12, marginBottom: 0 }}>
              Pool not funded yet — reports cannot be submitted for this brand until the pool
              covers at least one bounty.
            </p>
          ) : null}
        </section>

        {isAdmin ? (
          <section className="card">
            <h2 style={{ marginTop: 0 }}>Brand admin</h2>
            <p className="lead">
              Amounts are whole GEN. First deposit must be at least 5 GEN; bounties run 5–500 GEN
              in steps of 5 so hunter stakes stay whole.
            </p>

            <div className="formrow">
              <div>
                <label htmlFor="fund-amount">Add to pool (GEN)</label>
                <input
                  id="fund-amount"
                  type="text"
                  inputMode="numeric"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value.replace(/[^\d]/g, ""))}
                  style={{ minWidth: 120 }}
                />
              </div>
            </div>
            <TxAction
              label={`Fund ${fundAmount || "0"} GEN`}
              address={CORE_ADDRESS}
              functionName="fund_pool"
              args={[brandId]}
              value={BigInt(fundAmount || "0") * GEN}
              disabled={!fundAmount || BigInt(fundAmount || "0") === 0n}
              disabledReason="Enter a whole GEN amount"
              onDone={pool.retry}
            />

            <div className="formrow" style={{ marginTop: 24 }}>
              <div>
                <label htmlFor="bounty-amount">Bounty per confirmed report (GEN)</label>
                <input
                  id="bounty-amount"
                  type="text"
                  inputMode="numeric"
                  value={bountyAmount}
                  onChange={(e) => setBountyAmount(e.target.value.replace(/[^\d]/g, ""))}
                  style={{ minWidth: 120 }}
                />
              </div>
            </div>
            <TxAction
              label={`Set bounty to ${bountyAmount || "0"} GEN`}
              address={CORE_ADDRESS}
              functionName="set_bounty"
              args={[brandId, (BigInt(bountyAmount || "0") * GEN).toString()]}
              disabled={
                !bountyAmount ||
                BigInt(bountyAmount || "0") % 5n !== 0n ||
                BigInt(bountyAmount || "0") < 5n ||
                BigInt(bountyAmount || "0") > 500n
              }
              disabledReason="Must be 5–500 GEN, multiple of 5"
              onDone={pool.retry}
            />
          </section>
        ) : null}
      </div>
    </>
  );
}
