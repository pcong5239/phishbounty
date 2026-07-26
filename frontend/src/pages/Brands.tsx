import { useNavigate } from "react-router-dom";
import { useRead } from "../lib/useRead";
import { readContract } from "../lib/client";
import { getBrand, listNewestFirst } from "../lib/queries";
import type { Rec } from "../lib/queries";
import { REGISTRY_ADDRESS } from "../config/contracts";
import { Badge, Empty, ErrorBox, Skeleton } from "../components/ui";
import { toNumber } from "../lib/format";

export default function Brands() {
  const navigate = useNavigate();
  const brands = useRead(async () => {
    const count = toNumber(await readContract<unknown>(REGISTRY_ADDRESS, "get_brand_count"));
    const items = await listNewestFirst(count, 0, getBrand);
    return { count, items };
  }, []);

  return (
    <>
      <h1>Brands</h1>
      <p className="lead">
        Brands register their official domains and fund bounty pools that pay hunters for
        confirmed impersonation reports.
      </p>
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
