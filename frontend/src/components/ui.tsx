import { useState } from "react";
import type { ReactNode } from "react";
import type { BadgeTone } from "../lib/format";

export function StatTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="card tile">
      <div className="tile-value">{value}</div>
      <div className="tile-label">{label}</div>
    </div>
  );
}

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="errorbox" role="alert">
      <div>Could not load data from Studionet: {message}</div>
      <button type="button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty card">{children}</div>;
}

/**
 * Copy-to-clipboard for suspect URLs and addresses. Suspect URLs are never
 * rendered as anchors anywhere in this app — copying is the only affordance.
 */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}
