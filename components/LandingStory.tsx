"use client";

import { useEffect, useRef } from "react";

/**
 * A scroll-driven story on the home page. The section is several screens tall and its stage is sticky, so while you
 * scroll through it the page stays put and the picture changes step by step. Scroll progress picks the step
 * (data-step), CSS does the rest. No animation library: one scroll listener, no re-renders.
 *
 * The numbers are from the 150 made-up sample reviews and the section says so.
 */

const STEPS = [
  { title: "A pile of reviews nobody has time to read", text: "Hundreds of comments, each one a little different. The same few issues are hidden in there, repeated in different words." },
  { title: "Grouped into themes", text: "Each review is sorted into the topics it mentions: food, service speed, cleanliness, pricing and ambience." },
  { title: "Concerns stand out", text: "Positive mentions fade back. What is left are the reviews raising a concern, counted from the real file." },
  { title: "Three places to look first", text: "The areas raising the most concerns, ranked by how many reviews mention them. Each comes with ideas to check." },
];

const THEMES = [
  { key: "food", label: "Food", letter: "F" },
  { key: "speed", label: "Speed", letter: "S" },
  { key: "clean", label: "Clean", letter: "C" },
  { key: "price", label: "Price", letter: "P" },
  { key: "ambience", label: "Ambience", letter: "A" },
] as const;

const PRIORITIES = [
  { label: "Service speed", n: 44 },
  { label: "Food quality", n: 33 },
  { label: "Pricing", n: 26 },
];

// 60 tiles. Each stands for one review: its theme and whether it raises a concern are fixed, so the picture never changes between visits.
const TILES = Array.from({ length: 60 }, (_, i) => ({
  theme: THEMES[(i * 7 + (i >> 2)) % 5],
  concern: (i * 5 + (i >> 1)) % 7 < 3,
}));
// The three themes in the priorities list keep their concerns highlighted in the last step.
const TOP = new Set(["speed", "food", "price"]);
const TOTAL = 150;
const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");

export default function LandingStory() {
  const root = useRef<HTMLElement>(null);
  const count = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      const p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 1;
      const step = Math.min(STEPS.length - 1, Math.floor(p * STEPS.length));
      if (el.dataset.step !== String(step)) el.dataset.step = String(step);
      if (count.current) count.current.textContent = fmt(Math.min(1, p / 0.25) * TOTAL);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section ref={root} className="lstory" data-step="0" style={{ ["--steps" as string]: STEPS.length }} aria-labelledby="story-title">
      <div className="lstory__stick">
        <div className="lstory__text">
          <p className="eyebrow">From reviews to priorities</p>
          <h2 id="story-title" className="sr-only">
            How DineTrust turns reviews into priorities
          </h2>
          <ol className="lstory__steps">
            {STEPS.map((s, i) => (
              <li key={s.title} className="lstory__step" data-i={i}>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
          <p className="lstory__dots" aria-hidden="true">
            {STEPS.map((s) => (
              <span key={s.title} />
            ))}
          </p>
        </div>

        <div className="lstory__visual" aria-hidden="true">
          <p className="lstory__count">
            <span ref={count}>0</span> <small>sample reviews read</small>
          </p>
          <div className="lstory__wall">
            {TILES.map((t, i) => (
              <span key={i} className={`lstory__tile lstory__tile--${t.theme.key}${t.concern ? " is-concern" : ""}${t.concern && TOP.has(t.theme.key) ? " is-top" : ""}`}>
                {t.theme.letter}
              </span>
            ))}
          </div>
          <ul className="lstory__legend">
            {THEMES.map((t) => (
              <li key={t.key}>
                <span className={`lstory__swatch lstory__tile--${t.key}`}>{t.letter}</span> {t.label}
              </li>
            ))}
          </ul>
          <ol className="lstory__rank">
            {PRIORITIES.map((p, i) => (
              <li key={p.label} style={{ ["--w" as string]: `${(p.n / PRIORITIES[0].n) * 100}%`, ["--d" as string]: `${i * 120}ms` }}>
                <span>
                  {i + 1}. {p.label}
                </span>
                <b>{p.n} reviews raise a concern</b>
                <i />
              </li>
            ))}
          </ol>
          <p className="lstory__note">Sample data: 150 made-up reviews, not a real restaurant.</p>
        </div>
      </div>
    </section>
  );
}
