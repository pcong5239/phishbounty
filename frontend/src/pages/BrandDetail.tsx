import { useParams } from "react-router-dom";
import { useRead } from "../lib/useRead";
import { getBrand, getPool } from "../lib/queries";
import { Badge, ErrorBox, Skeleton } from "../components/ui";
import { shortAddress, toBigInt, weiToGen } from "../lib/format";

export default function BrandDetail() {
  const { id } = useParams();
  const brandId = Number(id);

  const brand = useRead(() => getBrand(brandId), [brandId]);
  const pool = useRead(() => getPool(brandId), [brandId]);

  if (brand.error) return <ErrorBox message={brand.error} onRetry={brand.retry} />;
  if (brand.loading || !brand.data) return <Skeleton rows={6} />;

  const b = brand.data;

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
      </div>
    </>
  );
}
