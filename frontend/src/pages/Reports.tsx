import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRead } from "../lib/useRead";
import { readContract } from "../lib/client";
import { getReport, listNewestFirst } from "../lib/queries";
import type { Rec } from "../lib/queries";
import { CORE_ADDRESS, LIST_PAGE_SIZE } from "../config/contracts";
import { Badge, Empty, ErrorBox, Skeleton } from "../components/ui";
import { statusLabel, toNumber, verdictLabel } from "../lib/format";

export default function Reports() {
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0);

  const reports = useRead(async () => {
    const count = toNumber(await readContract<unknown>(CORE_ADDRESS, "get_report_count"));
    const items = await listNewestFirst(count, offset, getReport);
    return { count, items };
  }, [offset]);

  return (
    <>
      <h1>Reports</h1>
      <p className="lead">
        Every report stakes GEN on a claim that a live page impersonates a registered brand.
        Validators render the evidence and decide by consensus.
      </p>
      {reports.error ? (
        <ErrorBox message={reports.error} onRetry={reports.retry} />
      ) : reports.loading ? (
        <Skeleton rows={4} />
      ) : reports.data && reports.data.items.length > 0 ? (
        <>
          <table className="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>Brand</th>
                <th>Suspect domain</th>
                <th>Status</th>
                <th>Verdict</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {reports.data.items.map((r: Rec) => {
                const id = toNumber(r.id);
                const st = statusLabel(r.status);
                const vd = verdictLabel(r.verdict);
                return (
                  <tr
                    key={id}
                    className="rowlink"
                    tabIndex={0}
                    role="link"
                    aria-label={`Open report ${id}`}
                    onClick={() => navigate(`/reports/${id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") navigate(`/reports/${id}`);
                    }}
                  >
                    <td>#{id}</td>
                    <td>#{toNumber(r.brand_id)}</td>
                    <td className="mono">{String(r.suspect_domain)}</td>
                    <td>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </td>
                    <td>
                      <Badge tone={vd.tone}>{vd.label}</Badge>
                    </td>
                    <td>{toNumber(r.verdict) === 0 ? "—" : `${toNumber(r.confidence)}%`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {reports.data.count > offset + LIST_PAGE_SIZE ? (
            <p>
              <button type="button" onClick={() => setOffset(offset + LIST_PAGE_SIZE)}>
                Load older reports
              </button>
            </p>
          ) : null}
        </>
      ) : (
        <Empty>No reports filed yet.</Empty>
      )}
    </>
  );
}
