"use client";

import { useRef, useState } from "react";
import ClaimBreakdown, { claimDomId } from "./ClaimBreakdown";
import Icon from "./Icons";
import RemovalReport from "./RemovalReport";
import ReplyComposer, { defaultApproach } from "./ReplyComposer";
import ReviewQuote from "./ReviewQuote";
import ScoreHow from "./ScoreHow";
import { useApp, type Entry } from "./AppProvider";
import { downloadCasePdf } from "@/lib/download-pdf";
import { buildRemovalReport } from "@/lib/report";
import { explain, groupClaims, riskLevel, RISK_LABEL, type Risk } from "@/lib/risk";
import { buildManagerMessage, whatsappLink } from "@/lib/share";
import type { CheckResult, ReplyApproach, ReviewItem } from "@/lib/types";

const NEXT: Record<Risk, { label: string; why: string; approach: ReplyApproach }> = {
  high: {
    label: "Report to Google",
    why: "Details in this review conflict with your records. Report it with the evidence summary below, and keep any reply polite.",
    approach: "factual",
  },
  medium: {
    label: "Reply politely and ask them to contact you",
    why: "We couldn't confirm this one, and that isn't proof of anything. Invite them to get in touch so you can find out what happened.",
    approach: "contact",
  },
  low: {
    label: "Apologise and fix the issue",
    why: "Nothing here conflicts with your records. A sincere apology and a quick fix is the best answer.",
    approach: "apology",
  },
};

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

  const groups = groupClaims(result);
  const next = NEXT[risk];
  const [focusId, setFocusId] = useState<string | null>(null);

  /** Jump from a line of the score to the claim it came from, and flash that claim. */
  function jumpToClaim(id: string) {
    setFocusId(id);
    document.getElementById(claimDomId(id))?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setFocusId((cur) => (cur === id ? null : cur)), 2600);
  }

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

          {/* 2. Risk level: the explanation is the main thing, the score is only a summary */}
          <section className="panel risk-hero case-section" style={{ ["--i" as string]: 1 }} aria-live="polite">
            <div className="hero-top">
              <span className="stamp">{RISK_LABEL[risk]}</span>
              {typeof result.score === "number" && (
                <span className="score-pill" title="A summary of the points listed below">
                  Score <strong>{result.score}</strong>
                  <small>/100</small>
                </span>
              )}
            </div>
            <p className="hero-explain">{explain(result)}</p>
            <ScoreHow result={result} onJump={jumpToClaim} />
          </section>
        </div>

        <div className="case-col">
          {/* 3. Claim by claim, in three groups */}
          <section className="panel claims-panel case-section" style={{ ["--i" as string]: 2 }}>
            <ClaimBreakdown groups={groups} visit={result.visit} focusId={focusId} />
          </section>
        </div>
      </div>

      {/* 4. Recommended next action */}
      <section className="panel next case-section" style={{ ["--i" as string]: 3 }}>
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
