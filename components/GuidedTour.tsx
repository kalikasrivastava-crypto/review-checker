"use client";

import { useEffect, useState } from "react";
import { useApp } from "./AppProvider";

const STEPS = [
  { sel: ".risk-hero .stamp", title: "This is the risk level", body: "A quick read of how much this review conflicts with your records: Low, Medium or High. It is a signal, not proof." },
  { sel: ".cg-mismatch", title: "These claims conflict with your records", body: "Each one shows what the review said and what your records show instead, with the source." },
  { sel: ".cg-unverified", title: "This is missing data", body: "Opinions and days with no records can't be checked. They never count against the review." },
  { sel: ".next-main", title: "This is what to do next", body: "A recommended step, plus a ready-made reply in English, Hindi or Hinglish, a PDF and a WhatsApp note for your manager." },
];

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function GuidedTour() {
  const { tourStep, setTourStep, endTour } = useApp();
  const [box, setBox] = useState<Box | null>(null);
  const step = STEPS[tourStep];

  // Find the thing this step points at (the case report may still be drawing), scroll to it and follow it.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    let tries = 0;
    const measure = () => {
      const el = document.querySelector(step.sel);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
      return true;
    };
    const find = () => {
      const el = document.querySelector(step.sel);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "auto" });
        measure();
        return true;
      }
      return false;
    };
    if (!find()) {
      timer = setInterval(() => {
        tries++;
        if (find()) clearInterval(timer);
        else if (tries > 12) {
          clearInterval(timer);
          // Nothing to point at (for example, no conflicts in this case): move on.
          if (tourStep < STEPS.length - 1) setTourStep(tourStep + 1);
          else endTour();
        }
      }, 250);
    }
    const follow = () => measure();
    window.addEventListener("resize", follow);
    window.addEventListener("scroll", follow, true);
    return () => {
      if (timer) clearInterval(timer);
      window.removeEventListener("resize", follow);
      window.removeEventListener("scroll", follow, true);
    };
  }, [step, tourStep, setTourStep, endTour]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && endTour();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [endTour]);

  const last = tourStep === STEPS.length - 1;
  const vh = typeof window === "undefined" ? 700 : window.innerHeight;
  const vw = typeof window === "undefined" ? 400 : window.innerWidth;
  const width = Math.min(320, vw - 24);
  let popStyle: React.CSSProperties = { width, left: 12, bottom: 12 };
  if (box) {
    const left = Math.min(Math.max(12, box.left), vw - width - 12);
    if (vh - (box.top + box.height) >= 230) popStyle = { width, left, top: box.top + box.height + 12 };
    else if (box.top >= 230) popStyle = { width, left, bottom: vh - box.top + 12 };
  }

  return (
    <div className="tour" role="dialog" aria-label="Guided tour">
      {box && <div className="tour-spot" style={{ top: box.top - 6, left: box.left - 6, width: box.width + 12, height: box.height + 12 }} />}
      <div className="tour-pop" style={popStyle}>
        <p className="tour-count">
          {tourStep + 1} of {STEPS.length}
        </p>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div className="actions">
          <button type="button" className="btn btn-solid btn-small" onClick={() => (last ? endTour() : setTourStep(tourStep + 1))}>
            {last ? "Done" : "Next"}
          </button>
          {tourStep > 0 && (
            <button type="button" className="btn btn-small" onClick={() => setTourStep(tourStep - 1)}>
              Back
            </button>
          )}
          {!last && (
            <button type="button" className="link-button" onClick={endTour}>
              Skip tour
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
