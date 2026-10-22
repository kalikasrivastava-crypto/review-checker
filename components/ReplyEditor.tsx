"use client";

import { useState } from "react";

interface Props {
  loading: boolean;
  error: string | null;
  draft: string;
  warning?: string;
  onChange: (text: string) => void;
  onRetry: () => void;
}

export default function ReplyEditor({ loading, error, draft, warning, onChange, onRetry }: Props) {
  const [approved, setApproved] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (loading) {
    return (
      <section className="card">
        <h2>Reply draft</h2>
        <p className="muted">Writing a reply…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="card">
        <h2>Reply draft</h2>
        <p className="error">Couldn&apos;t draft a reply. {error}</p>
        <button type="button" onClick={onRetry}>
          Try again
        </button>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Reply draft</h2>
      {warning && <p className="warning">{warning}</p>}
      <textarea
        value={draft}
        rows={6}
        onChange={(e) => {
          onChange(e.target.value);
          setApproved(false);
        }}
      />
      <div className="actions">
        <button type="button" onClick={() => setApproved(true)} disabled={!draft.trim() || approved}>
          Approve
        </button>
        {approved && (
          <>
            <span className="approved">Approved – ready to paste into Google</span>
            <button type="button" onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
