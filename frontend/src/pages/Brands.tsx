import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRead } from "../lib/useRead";
import { readContract } from "../lib/client";
import { getBrand, listNewestFirst } from "../lib/queries";
import type { Rec } from "../lib/queries";
import { REGISTRY_ADDRESS } from "../config/contracts";
import { Badge, Empty, ErrorBox, Skeleton } from "../components/ui";
import { TxAction } from "../components/TxAction";
import { toNumber } from "../lib/format";
import { registerBrandIntent, registrationProblem } from "../lib/brand-onboarding";

export default function Brands() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [domainsCsv, setDomainsCsv] = useState("");
  const [scopeNote, setScopeNote] = useState("");
  const brands = useRead(async () => {
    const count = toNumber(await readContract<unknown>(REGISTRY_ADDRESS, "get_brand_count"));
    const items = await listNewestFirst(count, 0, getBrand);
    return { count, items };
  }, []);
  const problem = registrationProblem(name, domainsCsv, scopeNote);
  const registration = registerBrandIntent(name, domainsCsv, scopeNote);

  return (
    <>
      <h1>Brands</h1>
      <p className="lead">
        Brands register their official domains and fund bounty pools that pay hunters for
        confirmed impersonation reports.
      </p>

      <section className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>Register a brand</h2>
        <p className="lead">
          The connected wallet signs the registration and becomes the brand admin. After it
          finalizes, open the new brand to fund at least 5 GEN and set its bounty; use a different
          wallet to file a report.
        </p>
        <div className="formrow">
          <div>
            <label htmlFor="brand-name">Brand name</label>
            <input
              id="brand-name"
              type="text"
              maxLength={64}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="brand-domains">Official domains (comma-separated)</label>
            <input
              id="brand-domains"
              type="text"
              placeholder="example.com, support.example.com"
              value={domainsCsv}
              onChange={(event) => setDomainsCsv(event.target.value)}
            />
          </div>
        </div>
        <div className="formrow">
          <div style={{ flex: 1 }}>
            <label htmlFor="brand-scope">Scope note</label>
            <textarea
              id="brand-scope"
              maxLength={500}
              rows={3}
              value={scopeNote}
              onChange={(event) => setScopeNote(event.target.value)}
              style={{ width: "100%" }}
            />
          </div>
        </div>
        <TxAction
          label="Register brand"
          address={registration.address}
          functionName={registration.functionName}
          args={registration.args}
          value={registration.value}
          disabled={problem !== null}
          disabledReason={problem ?? undefined}
          onDone={() => {
            setName("");
            setDomainsCsv("");
            setScopeNote("");
            brands.retry();
          }}
        />
      </section>

      {brands.error ? (
        <ErrorBox message={brands.error} onRetry={brands.retry} />
      ) : brands.loading ? (
        <Skeleton rows={4} />
      ) : brands.data && brands.data.items.length > 0 ? (
        <table className="data">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Official domains</th>
              <th>Status</th>
              <th>Scope</th>
            </tr>
          </thead>
          <tbody>
            {brands.data.items.map((brand: Rec) => {
              const id = toNumber(brand.id);
              return (
                <tr
                  key={id}
                  className="rowlink"
                  tabIndex={0}
                  role="link"
                  aria-label={`Open brand ${String(brand.name)}`}
                  onClick={() => navigate(`/brands/${id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") navigate(`/brands/${id}`);
                  }}
                >
                  <td>#{id}</td>
                  <td>{String(brand.name)}</td>
                  <td>
                    {(brand.domains as unknown[]).map((d) => (
                      <span key={String(d)} className="chip">
                        {String(d)}
                      </span>
                    ))}
                  </td>
                  <td>
                    {brand.active ? (
                      <Badge tone="ok">Active</Badge>
                    ) : (
                      <Badge tone="neutral">Inactive</Badge>
                    )}
                  </td>
                  <td>{String(brand.scope_note)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <Empty>No brands registered yet.</Empty>
      )}
    </>
  );
}
