import { useState } from "react";
import { useRead } from "../lib/useRead";
import { readContract } from "../lib/client";
import { getBrand, getPool, listNewestFirst } from "../lib/queries";
import type { Rec } from "../lib/queries";
import { CORE_ADDRESS, REGISTRY_ADDRESS } from "../config/contracts";
import { Empty, ErrorBox, Skeleton } from "../components/ui";
import { TxAction } from "../components/TxAction";
import { toBigInt, toNumber, weiToGen } from "../lib/format";

/** Mirrors the contract's submit_report URL guards so users fail fast, client-side. */
function urlProblem(raw: string): string | null {
  const url = raw.trim();
  if (url.length === 0) return "Enter the suspected impersonation URL.";
  if (url.length > 300) return "URL must be 300 characters or fewer.";
  if (!/^https?:\/\//i.test(url)) return "URL must start with http:// or https://.";
  const rest = url.replace(/^https?:\/\//i, "");
  const hostSegment = rest.split(/[/?#]/)[0] ?? "";
  if (hostSegment.includes("@")) return "URLs with credentials are not accepted.";
  const host = hostSegment.split(":")[0]?.toLowerCase() ?? "";
  if (host.length === 0) return "URL has no hostname.";
  if (/^\d+(\.\d+)*$/.test(host)) return "IP-address hosts are not accepted — use a domain name.";
  if (!host.includes(".")) return "Hostname must contain a dot (single-label hosts are rejected).";
  return null;
}

export default function Hunt() {
  const [brandId, setBrandId] = useState<number | null>(null);
  const [url, setUrl] = useState("");
  const [touched, setTouched] = useState(false);

  const brands = useRead(async () => {
    const count = toNumber(await readContract<unknown>(REGISTRY_ADDRESS, "get_brand_count"));
    const items = await listNewestFirst(count, 0, getBrand);
    return items.filter((b) => b.active === true);
  }, []);

  const pool = useRead(
    () => (brandId === null ? Promise.resolve(null) : getPool(brandId)),
    [brandId],
  );

  const problem = urlProblem(url);
  const stake = pool.data ? toBigInt((pool.data as Rec).required_stake) : 0n;
  const funded = pool.data ? toBigInt((pool.data as Rec).balance) - toBigInt((pool.data as Rec).reserved) : 0n;
  const bounty = pool.data ? toBigInt((pool.data as Rec).bounty_amount) : 0n;
  const poolReady = bounty > 0n && funded >= bounty;

  return (
    <>
      <h1>File a report</h1>
      <p className="lead">
        Stake GEN on the claim that a live page impersonates a registered brand. If validators
        confirm it, you earn the bounty and the domain enters the blocklist. If they clear it,
        your stake is forfeited to the brand's pool.
      </p>

      {brands.error ? (
        <ErrorBox message={brands.error} onRetry={brands.retry} />
      ) : brands.loading ? (
        <Skeleton rows={3} />
      ) : brands.data && brands.data.length > 0 ? (
        <div className="stack">
          <section className="card">
            <div className="formrow">
              <div>
                <label htmlFor="brand-select">Brand being impersonated</label>
                <select
                  id="brand-select"
                  value={brandId ?? ""}
                  onChange={(e) => setBrandId(e.target.value === "" ? null : Number(e.target.value))}
                  style={{ font: "inherit", padding: "6px 10px", minWidth: 280 }}
                >
                  <option value="">Select a brand…</option>
                  {brands.data.map((b) => (
                    <option key={toNumber(b.id)} value={toNumber(b.id)}>
                      #{toNumber(b.id)} — {String(b.name)} ({(b.domains as unknown[]).join(", ")})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="formrow">
              <div style={{ flex: 1 }}>
                <label htmlFor="suspect-url">Suspected impersonation URL</label>
                <input
                  id="suspect-url"
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="https://…"
                  value={url}
                  style={{ width: "100%", minWidth: 320 }}
                  onChange={(e) => setUrl(e.target.value)}
                  onBlur={() => setTouched(true)}
                  aria-invalid={touched && problem ? true : undefined}
                  aria-describedby={touched && problem ? "suspect-url-error" : undefined}
                />
                {touched && problem ? (
                  <p
                    id="suspect-url-error"
                    role="alert"
                    style={{ color: "var(--danger)", margin: "4px 0 0" }}
                  >
                    {problem}
                  </p>
                ) : null}
              </div>
            </div>

            {brandId !== null && pool.data ? (
              <dl className="kv" style={{ marginTop: 8 }}>
                <dt>Bounty if confirmed</dt>
                <dd>{bounty === 0n ? "Brand has not set a bounty yet" : weiToGen(bounty)}</dd>
                <dt>Your stake</dt>
                <dd>{stake === 0n ? "—" : weiToGen(stake)}</dd>
                <dt>Pool available</dt>
                <dd>{weiToGen(funded)}</dd>
              </dl>
            ) : null}
          </section>

          {brandId !== null ? (
            <TxAction
              label={stake > 0n ? `Stake ${weiToGen(stake)} and submit` : "Submit report"}
              address={CORE_ADDRESS}
              functionName="submit_report"
              args={[brandId, url.trim()]}
              value={stake}
              disabled={Boolean(problem) || !poolReady || stake === 0n}
              disabledReason={
                problem
                  ? "Fix the URL first"
                  : !poolReady
                    ? "This brand's pool cannot cover a bounty yet"
                    : undefined
              }
              onDone={() => {
                setUrl("");
                setTouched(false);
                pool.retry();
              }}
            />
          ) : null}
        </div>
      ) : (
        <Empty>No active brands are accepting reports yet.</Empty>
      )}
    </>
  );
}
