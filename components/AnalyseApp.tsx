"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import ActionPlanView from "./dashboard/ActionPlanView";
import AppShell, { type View } from "./dashboard/AppShell";
import OverviewView, { type ActivityItem } from "./dashboard/OverviewView";
import ThemesView from "./dashboard/ThemesView";
import UploadView, { type Busy, type UploadSource } from "./dashboard/UploadView";
import { AI_REASONS, MAX_AI_REVIEWS, analysisFromLabels, prepareForAi, type AiLabels, type AnalysisMethod } from "@/lib/ai-analysis";
import { analyseReviews } from "@/lib/analysis";
import { buildPriorities } from "@/lib/priorities";
import { readTextWithProgress } from "@/lib/read-file";
import { buildReviews, MAX_FILE_BYTES, MAX_REVIEWS, readReviewFile, type ParsedReview, type ReviewColumns } from "@/lib/review-csv";
import { fileSize, plural } from "@/lib/format";

interface Source extends UploadSource {
  rows: string[][];
  /** Changes whenever the file or the chosen columns change, so an AI answer is only used for the reviews it was asked about. */
  version: number;
}

/** What the AI analysis returned for one version of the loaded reviews: labels, or the reason it didn't work. */
interface AiRun {
  version: number;
  labels: AiLabels | null;
  reason: string | null;
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** The dashboard: upload reviews, then see the overview, themes and action plan. Everything happens in the browser. */
export default function AnalyseApp() {
  const [source, setSource] = useState<Source | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("upload");
  const [busy, setBusy] = useState<Busy | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const activityId = useRef(0);
  const versionRef = useRef(0);
  const [useAi, setUseAi] = useState(false);
  const [aiRun, setAiRun] = useState<AiRun | null>(null);
  const pathname = usePathname();

  const parsed = useMemo(() => (source && source.columns.text !== undefined ? buildReviews(source.rows, source.columns) : null), [source]);
  // The AI's labels are used only when AI analysis is on and they were made for the reviews now loaded.
  const aiCurrent = useAi && aiRun !== null && source !== null && aiRun.version === source.version ? aiRun : null;
  const labels = aiCurrent?.labels ?? null;
  const analysis = useMemo(
    () => (parsed && parsed.reviews.length > 0 ? (labels ? analysisFromLabels(parsed.reviews, labels) : analyseReviews(parsed.reviews)) : null),
    [parsed, labels],
  );
  const priorities = useMemo(() => (analysis ? buildPriorities(analysis, labels?.steps) : null), [analysis, labels]);
  const method: AnalysisMethod = labels
    ? { kind: "ai" }
    : { kind: "keyword", note: aiCurrent?.reason ? (AI_REASONS[aiCurrent.reason] ?? AI_REASONS.unavailable) : null };

  function log(text: string) {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setActivity((prev) => [{ id: ++activityId.current, time, text }, ...prev].slice(0, 8));
  }

  function fail(message: string, note?: string) {
    setError(message);
    log(note ?? message);
  }

  /** Reads the text of a CSV into rows and checks it. Returns the reviews when they were loaded, otherwise null. */
  function load(kind: Source["kind"], name: string, text: string, size: number | null): { version: number; reviews: ParsedReview[] } | null {
    const file = readReviewFile(text);
    if (file.headers.length === 0 || file.rows.length === 0) {
      fail("That file has no reviews in it. It needs a header row and at least one review underneath.", `Couldn't use ${name}: no reviews found`);
      return null;
    }
    if (file.rows.length > MAX_REVIEWS) {
      fail(
        `That file has ${file.rows.length.toLocaleString()} rows. The limit is ${MAX_REVIEWS.toLocaleString()}. Try a shorter date range.`,
        `Couldn't use ${name}: ${file.rows.length.toLocaleString()} rows is over the limit`,
      );
      return null;
    }
    setError(null);
    const version = ++versionRef.current;
    setSource({ kind, name, size, headers: file.headers, rows: file.rows, columns: file.guess, version });
    setAiRun(null);
    setTicks({});
    if (file.guess.text === undefined) {
      log(`Read ${name}: choose which column holds the review text`);
      return { version, reviews: [] };
    }
    const { summary, reviews } = buildReviews(file.rows, file.guess);
    log(kind === "sample" ? `Loaded the sample data (${plural(summary.used, "made-up review")})` : `Read ${name}: ${plural(summary.rowsRead, "row")}, ${plural(summary.used, "review")} used`);
    return { version, reviews };
  }

  /** Asks the server to have Gemini label the reviews. Any failure is kept as a reason, and the keyword rules are used. */
  async function runAi(version: number, reviews: ParsedReview[]) {
    if (reviews.length === 0) return;
    const done = (labels: AiLabels | null, reason: string | null) => {
      setAiRun({ version, labels, reason });
      log(labels ? "AI analysis finished" : `AI analysis wasn't used (${(AI_REASONS[reason ?? ""] ?? AI_REASONS.unavailable).replace(/\.$/, "")}). Keyword rules were used`);
    };
    if (reviews.length > MAX_AI_REVIEWS) return done(null, "too_many");
    setBusy({ name: "your reviews", stage: "ai", progress: 100 });
    try {
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviews: prepareForAi(reviews) }),
        signal: AbortSignal.timeout(75_000),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; reason?: string; labels?: AiLabels["labels"]; steps?: AiLabels["steps"] } | null;
      if (data?.ok && Array.isArray(data.labels)) done({ labels: data.labels, steps: data.steps ?? {} }, null);
      else done(null, data?.reason ?? "unavailable");
    } catch {
      done(null, "network");
    }
    setBusy(null);
  }

  async function onFile(file: File) {
    if (!/\.(csv|txt)$/i.test(file.name) && !/csv|text\/plain/i.test(file.type)) {
      fail(
        "That doesn't look like a CSV file. In Excel or Google Sheets, choose File, then Save as or Download, then CSV.",
        `Couldn't use ${file.name}: not a CSV file`,
      );
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      fail(
        `That file is ${fileSize(file.size)}. The limit is ${fileSize(MAX_FILE_BYTES)}. Try a shorter date range.`,
        `Couldn't use ${file.name}: ${fileSize(file.size)} is over the limit`,
      );
      return;
    }
    setBusy({ name: file.name, stage: "reading", progress: 0 });
    try {
      const text = await readTextWithProgress(file, (progress) => setBusy({ name: file.name, stage: "reading", progress }));
      setBusy({ name: file.name, stage: "checking", progress: 100 });
      await nextFrame();
      if (load("upload", file.name, text, file.size)) setView("upload");
    } catch {
      fail("Couldn't read that file. Is it a CSV?", `Couldn't read ${file.name}`);
    }
    setBusy(null);
  }

  /** Loads built-in sample reviews through the same checks and analysis as an uploaded file. "quick" is five reviews; "full" is 150. */
  async function onSample(which: "quick" | "full" = "full") {
    const file = which === "quick" ? "sample-reviews-5.csv" : "sample-reviews.csv";
    setBusy({ name: "the sample reviews", stage: "checking", progress: 100 });
    try {
      const res = await fetch(`/${file}`);
      if (!res.ok) throw new Error("missing");
      const loaded = load("sample", file, await res.text(), null);
      if (loaded) {
        if (useAi) await runAi(loaded.version, loaded.reviews);
        setView("overview");
      }
    } catch {
      fail("Couldn't load the sample reviews. Check your connection and try again.");
    }
    setBusy(null);
  }

  function onColumn(field: keyof ReviewColumns, value: number | null) {
    setSource((cur) => {
      if (!cur) return cur;
      const next = { ...cur.columns };
      if (value === null) delete next[field];
      else next[field] = value;
      return { ...cur, columns: next, version: ++versionRef.current };
    });
  }

  async function onViewResults() {
    if (useAi && parsed && source && !(aiRun && aiRun.version === source.version)) await runAi(source.version, parsed.reviews);
    setView("overview");
  }

  function leave(message: string) {
    setSource(null);
    setAiRun(null);
    setError(null);
    setTicks({});
    setView("upload");
    log(message);
  }

  // The home page links here with #sample to open the sample data straight away. This page stays mounted
  // when you visit the home page and come back, so watch the path too, and clear the hash once handled.
  useEffect(() => {
    if (pathname === "/analyse" && window.location.hash === "#sample") {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      void Promise.resolve().then(() => onSample("full"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Each new screen starts at the top.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);

  const isSample = source?.kind === "sample";
  const goUpload = () => setView("upload");
  const loadFullSample = () => void onSample("full");

  return (
    <AppShell
      view={view}
      onNavigate={setView}
      source={source && parsed ? { kind: source.kind, name: source.name, reviews: parsed.summary.used } : null}
      themeCount={analysis ? analysis.themes.filter((t) => t.reviews > 0).length : null}
      planCount={priorities ? priorities.priorities.length : null}
    >
      <p className="sr-only" role="status">
        {analysis ? `Analysis ready for ${analysis.reviewCount} reviews.` : ""}
      </p>

      {view === "upload" && (
        <UploadView
          source={source}
          parsed={parsed}
          error={error}
          busy={busy}
          onFile={onFile}
          onSample={onSample}
          onClear={() => leave("Cleared the loaded reviews")}
          onColumn={onColumn}
          useAi={useAi}
          onUseAi={setUseAi}
          onViewResults={() => void onViewResults()}
        />
      )}
      {view === "overview" && (
        <OverviewView
          analysis={analysis}
          priorities={priorities}
          summary={parsed?.summary ?? null}
          isSample={isSample}
          method={method}
          activity={activity}
          onGo={setView}
          onSample={loadFullSample}
          onUseOwn={() => leave("Left the sample data")}
        />
      )}
      {view === "themes" && <ThemesView analysis={analysis} isSample={isSample} method={method} onGo={goUpload} onSample={loadFullSample} onUseOwn={() => leave("Left the sample data")} />}
      {view === "plan" && (
        <ActionPlanView
          analysis={analysis}
          priorities={priorities}
          isSample={isSample}
          method={method}
          ticks={ticks}
          onToggle={(key) => setTicks((t) => ({ ...t, [key]: !t[key] }))}
          onGo={goUpload}
          onSample={loadFullSample}
          onUseOwn={() => leave("Left the sample data")}
        />
      )}
    </AppShell>
  );
}
