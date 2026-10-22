"use client";

import { useEffect, useState } from "react";
import { useApp } from "./AppProvider";

/** Shows the check queue: progress, the current review, and a countdown while it waits for the free AI limit. */
export default function QueueBar() {
  const { queue, cancelQueue, reviews } = useApp();
  const [now, setNow] = useState(0); // set by the timer below, never during render

  useEffect(() => {
    if (!queue.active) return;
    const tick = () => setNow(Date.now());
    const t = setInterval(tick, 500);
    const first = setTimeout(tick, 0);
    return () => {
      clearInterval(t);
      clearTimeout(first);
    };
  }, [queue.active]);

  if (!queue.active) return null;

  const pct = queue.total ? Math.round((queue.done / queue.total) * 100) : 0;
  const secs = queue.waitUntil && now > 0 ? Math.max(0, Math.ceil((queue.waitUntil - now) / 1000)) : null;
  const current = reviews.find((r) => r.id === queue.currentId);

  return (
    <div className="queue-bar panel" role="status" aria-live="polite">
      <div className="queue-top">
        <strong>
          Checking {Math.min(queue.done + 1, queue.total)} of {queue.total}
        </strong>
        <button type="button" className="btn btn-small" onClick={cancelQueue}>
          Stop
        </button>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label="Check queue progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="muted small">
        {queue.message || (current ? `Checking ${current.author}…` : "Working…")}
        {secs !== null && secs > 0 ? ` (${secs}s)` : ""}
        {" · One review at a time, to stay within the free AI limit."}
      </p>
    </div>
  );
}
