"use client";

import { useState } from "react";
import CopyButton from "./CopyButton";
import { useApp, type Entry } from "./AppProvider";
import { buildManagerMessage, whatsappLink } from "@/lib/share";
import type { CheckResult, ReviewItem } from "@/lib/types";

/** For a genuine complaint: a note the owner can send to the manager on WhatsApp. */
export default function ManagerShare({ review, entry, result }: { review: ReviewItem; entry: Entry; result: CheckResult }) {
  const { settings } = useApp();
  const latest = Object.values(entry.replies ?? {}).sort((a, b) => b.at.localeCompare(a.at))[0];
  const initial = buildManagerMessage({
    restaurant: settings?.name ?? "",
    review,
    result,
    suggestedReply: latest?.text,
  });
  const [edited, setEdited] = useState<string | null>(null);
  const message = edited ?? initial;

  return (
    <section className="panel fade-in">
      <h2>Tell your manager</h2>
      <p className="muted">
        This looks like a genuine complaint. Send a note to whoever should follow it up. You choose who gets it in
        WhatsApp.
      </p>
      <label className="sr-only" htmlFor={`share-${review.id}`}>
        Message to your manager
      </label>
      <textarea id={`share-${review.id}`} value={message} rows={8} onChange={(e) => setEdited(e.target.value)} />
      <div className="actions">
        <a className="btn btn-whatsapp" href={whatsappLink(message)} target="_blank" rel="noopener noreferrer">
          Share on WhatsApp
        </a>
        <CopyButton text={message} label="Copy message" />
      </div>
    </section>
  );
}
