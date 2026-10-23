"use client";

import { useEffect, useRef } from "react";

/** A row of figures that count up once, the first time the row scrolls into view. Shows the final numbers if motion is reduced. */
export default function CountUp({ items }: { items: { to: number; label: string; prefix?: string }[] }) {
  const root = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nums = [...el.querySelectorAll<HTMLElement>("[data-to]")];
    if (reduce) return;
    nums.forEach((n) => (n.textContent = "0"));
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const k = Math.min(1, (now - start) / 1400);
          const eased = 1 - Math.pow(1 - k, 3);
          nums.forEach((n) => (n.textContent = Math.round(Number(n.dataset.to) * eased).toLocaleString("en-IN")));
          if (k < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <ul ref={root} className="ledger">
      {items.map((it) => (
        <li key={it.label}>
          <strong>
            {it.prefix}
            <span data-to={it.to}>{it.to.toLocaleString("en-IN")}</span>
          </strong>
          <span>{it.label}</span>
        </li>
      ))}
    </ul>
  );
}
