"use client";

import { useRef, useState } from "react";
import Icon from "./Icons";
import RemovalReport from "./RemovalReport";
import ReplyComposer, { defaultApproach } from "./ReplyComposer";
import ReviewQuote from "./ReviewQuote";
import RiskRing from "./RiskRing";
import { useApp, type Entry } from "./AppProvider";
import { downloadCasePdf } from "@/lib/download-pdf";
import { buildRemovalReport } from "@/lib/report";
import { groupEvidence, plainSummary, riskLevel, RISK_LABEL, sortedFactors, type EvidenceItem, type Risk } from "@/lib/risk";
import { buildManagerMessage, whatsappLink } from "@/lib/share";
import type { CheckResult, ReplyApproach, ReviewItem } from "@/lib/types";

const NEXT: Record<Risk, { label: string; why: string; approach: ReplyApproach }> = {
  high: {
    label: "Report to Google",
    why: "Several details don't fit your records. Report it with the evidence summary below, and keep any reply polite.",
    approach: "factual",
  },
  medium: {
    label: "Reply politely and ask them to contact you",
    why: "We couldn't confirm this one, which isn't proof it's fake. Invite them to get in touch so you can find out what happened.",
    approach: "contact",
  },
  low: {
    label: "Apologise and fix the issue",
    why: "This looks like a genuine complaint. A sincere apology and a quick fix is the best answer.",
    approach: "apology",
  },
};

function EvidenceRow({ item }: { item: EvidenceItem }) {
  const badge =
    item.tone === "supports" ? "Supports" : item.tone === "contradicts" ? "Contradicts" : item.tone === "missing" ? "Not found" : "Context";
  return (
    <li className={`ev-item evi-${item.tone}`}>
      <span className="ev-icon">
        <Icon name={item.icon} />
      </span>
      <div className="ev-body">
        {item.claim && <p className="ev-claim">&ldquo;{item.claim}&rdquo;</p>}
        <p className="ev-text">{item.text}</p>
      </div>
      <span className="ev-badge">{badge}</span>
    </li>
  );
}

export default function CaseReport({
  review,
  entry,
  result,
  toolbar,
}: {
  review: ReviewItem;
  entry: Entry;
  result: CheckResult;
  toolbar: React.ReactNode;
}) {
  const { settings, setStatus, toast } = useApp();
  const risk = riskLevel(result);
  const [approach, setApproach] = useState<ReplyApproach>(() => defaultApproach(result));
  const [showReport, setShowReport] = useState(false);
  const composerRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const factors = result.breakdown ? sortedFactors(result.breakdown) : null;
  const { found, missing } = groupEvidence(result);
  const next = NEXT[risk];

  const latestDraft = Object.values(entry.replies ?? {}).sort((a, b) => b.at.localeCompare(a.at))[0];
  const whatsapp = whatsappLink(
    buildManagerMessage({ restaurant: settings?.name ?? "", review, result, suggestedReply: latestDraft?.text }),
  );

  function goToReply(a: ReplyApproach) {
    setApproach(a);
    requestAnimationFrame(() => {
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      composerRef.current?.querySelector("textarea")?.focus({ preventScroll: true });
    });
  }

  function mainAction() {
    if (risk === "high") {
      setShowReport(true);
      requestAnimationFrame(() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } else {
      goToReply(next.approach);
    }
  }

  async function pdf() {
    try {
      await downloadCasePdf({ restaurant: settings?.name ?? "", review, result });
      toast("PDF downloaded", "success");
    } catch {
      toast("Couldn't create the PDF. Try the copy buttons instead.", "error");
    }
  }

  return (
    <article className={`case case-${risk}`} aria-label="Case report">
      <div className="case-grid">
        <div className="case-col">
          {/* 1. The review */}
          <div className="case-section" style={{ ["--i" as string]: 0 }}>
            <ReviewQuote review={review} entry={entry} result={result}>
              {toolbar}
            </ReviewQuote>
          </div>

          {/* 2. Risk level (the hero) */}
          <section className="panel risk-hero case-section" style={{ ["--i" as string]: 1 }} aria-live="polite">
            <div className="hero-top">
              <span className="stamp">{RISK_LABEL[risk]}</span>
              {typeof result.score === "number" && <RiskRing score={result.score} />}
            </div>
            <p className="hero-summary">{plainSummary(result)}</p>
            <p className="hero-meta">
              Verdict: <strong>{result.verdict}</strong> · confidence {result.confidence}%
            </p>
          </section>
        </div>

        <div className="case-col">
          {/* 3. Why it was flagged */}
          <section className="panel case-section" style={{ ["--i" as string]: 2 }}>
            <h2>{risk === "low" ? "Why it looks fine" : factors?.some((f) => f.points > 0) ? "Why it was flagged" : "Why we're unsure"}</h2>
            {factors === null ? (
              <p className="muted small">This result was saved before reasons were recorded. Re-check it to see them.</p>
            ) : factors.length === 0 ? (
              <p className="reasons-empty">
                <Icon name="trust" />{" "}
                {risk === "medium" ? "Nothing raised suspicion, but there was very little to check." : "Nothing in this review raised suspicion."}
              </p>
            ) : (
              <ul className="reasons">
                {factors.map((f, i) => (
                  <li key={i} className={f.points > 0 ? "reason reason-up" : "reason reason-down"}>
                    <span className="reason-icon">
                      <Icon name={f.icon ?? (f.points > 0 ? "info" : "trust")} />
                    </span>
                    <span className="reason-label">{f.label}</span>
                    <span className="pts">
                      {f.points > 0 ? "+" : "−"}
                      {Math.abs(f.points)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 4. Evidence found */}
          <section className="panel ev-section ev-found case-section" style={{ ["--i" as string]: 3 }}>
            <h2>
              <Icon name="check" className="icon icon-h" /> Evidence found
            </h2>
            {found.length === 0 ? (
              <p className="muted small">No record could be matched to this review.</p>
            ) : (
              <ul className="ev-list">
                {found.map((it, i) => (
                  <EvidenceRow key={i} item={it} />
                ))}
              </ul>
            )}
          </section>

          {/* 5. Missing evidence */}
          <section className="panel ev-section ev-missing case-section" style={{ ["--i" as string]: 4 }}>
            <h2>
              <Icon name="question" className="icon icon-h" /> Missing evidence
            </h2>
            {missing.length === 0 ? (
              <p className="muted small">Nothing missing: every claim we could check had a record.</p>
            ) : (
              <ul className="ev-list">
                {missing.map((it, i) => (
                  <EvidenceRow key={i} item={it} />
                ))}
              </ul>
            )}
            <p className="ev-note">
              Missing evidence means we <strong>couldn&apos;t confirm</strong> something. It is not proof that the review is fake.
            </p>
          </section>
        </div>
      </div>

      {/* 6. Recommended next action */}
      <section className="panel next case-section" style={{ ["--i" as string]: 5 }}>
        <p className="next-kicker">Recommended next step</p>
        <p className="next-why">{next.why}</p>
        <div className="next-main">
          <button type="button" className="btn btn-primary next-button" onClick={mainAction}>
            <Icon name={risk === "high" ? "flag" : "reply"} /> {next.label}
          </button>
          {risk === "low" && (
            <a className="btn btn-whatsapp next-wa" href={whatsapp} target="_blank" rel="noopener noreferrer">
              <Icon name="whatsapp" /> WhatsApp the manager
            </a>
          )}
        </div>

        <div ref={composerRef} className="next-composer">
          <ReplyComposer review={review} entry={entry} result={result} approach={approach} onApproachChange={setApproach} />
        </div>

        <div className="secondary-actions">
          <button type="button" className="btn btn-small" onClick={pdf}>
            <Icon name="pdf" /> Download PDF
          </button>
          <button
            type="button"
            className="btn btn-small"
            disabled={entry.status === "replied"}
            onClick={() => {
              setStatus(review.id, "replied");
              toast("Marked as replied", "success");
            }}
          >
            <Icon name="check" /> {entry.status === "replied" ? "Marked as replied" : "Mark as replied"}
          </button>
          {risk !== "low" && (
            <a className="btn btn-small" href={whatsapp} target="_blank" rel="noopener noreferrer">
              <Icon name="whatsapp" /> Share on WhatsApp
            </a>
          )}
        </div>

        {(showReport || entry.status === "reported") && (
          <div ref={reportRef} className="next-report">
            <RemovalReport
              key={`report-${review.id}`}
              initial={buildRemovalReport(review, result)}
              reported={entry.status === "reported"}
              onPdf={pdf}
              onMarkReported={() => {
                setStatus(review.id, "reported");
                toast("Marked as reported", "success");
              }}
            />
          </div>
        )}
      </section>
    </article>
  );
}
