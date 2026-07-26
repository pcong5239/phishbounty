import { useRead } from "../lib/useRead";
import { getOverviewCounts, getRecentEvents } from "../lib/queries";
import { StatTile, Skeleton, ErrorBox, Empty, Badge } from "../components/ui";
import { eventKindLabel, shortAddress, timeAgo, toNumber } from "../lib/format";

export default function Overview() {
  const counts = useRead(() => getOverviewCounts(), []);
  const events = useRead(() => getRecentEvents(10), []);

  return (
    <>
      <h1>Overview</h1>
      <p className="lead">
        Brand-impersonation bounties judged by GenLayer validators. Live state from Studionet.
      </p>

      {counts.error ? (
        <ErrorBox message={counts.error} onRetry={counts.retry} />
      ) : counts.loading ? (
        <Skeleton rows={2} />
      ) : (
        <div className="tiles">
          <StatTile label="Registered brands" value={counts.data!.brands} />
          <StatTile label="Reports filed" value={counts.data!.reports} />
          <StatTile label="Blocklist events" value={counts.data!.events} />
        </div>
      )}

      <h2>Recent blocklist events</h2>
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
          No blocklist events yet. A domain is listed only after a report is confirmed by
          validator consensus and settled.
        </Empty>
      )}
    </>
  );
}
