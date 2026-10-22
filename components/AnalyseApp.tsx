"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ActionPlanView from "./dashboard/ActionPlanView";
import AppShell, { type View } from "./dashboard/AppShell";
import OverviewView, { type ActivityItem } from "./dashboard/OverviewView";
import ThemesView from "./dashboard/ThemesView";
import UploadView, { type Busy, type UploadSource } from "./dashboard/UploadView";
import { analyseReviews } from "@/lib/analysis";
import { buildPriorities } from "@/lib/priorities";
import { readTextWithProgress } from "@/lib/read-file";
import { buildReviews, MAX_FILE_BYTES, MAX_REVIEWS, readReviewFile, type ReviewColumns } from "@/lib/review-csv";
import { fileSize, plural } from "@/lib/format";

interface Source extends UploadSource {
  rows: string[][];
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
  const autoSample = useRef(false);

  const parsed = useMemo(() => (source && source.columns.text !== undefined ? buildReviews(source.rows, source.columns) : null), [source]);
  const analysis = useMemo(() => (parsed && parsed.reviews.length > 0 ? analyseReviews(parsed.reviews) : null), [parsed]);
  const priorities = useMemo(() => (analysis ? buildPriorities(analysis) : null), [analysis]);

  function log(text: string) {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setActivity((prev) => [{ id: ++activityId.current, time, text }, ...prev].slice(0, 8));
  }

  function fail(message: string, note?: string) {
    setError(message);
    log(note ?? message);
  }

  /** Reads the text of a CSV into rows and checks it. Returns true when the reviews were loaded. */
  function load(kind: Source["kind"], name: string, text: string, size: number | null): boolean {
    const file = readReviewFile(text);
    if (file.headers.length === 0 || file.rows.length === 0) {
      fail("That file has no reviews in it. It needs a header row and at least one review underneath.", `Couldn't use ${name}: no reviews found`);
      return false;
    }
    if (file.rows.length > MAX_REVIEWS) {
      fail(
        `That file has ${file.rows.length.toLocaleString()} rows. The limit is ${MAX_REVIEWS.toLocaleString()}. Try a shorter date range.`,
        `Couldn't use ${name}: ${file.rows.length.toLocaleString()} rows is over the limit`,
      );
      return false;
    }
    setError(null);
    setSource({ kind, name, size, headers: file.headers, rows: file.rows, columns: file.guess });
    setTicks({});
    if (file.guess.text === undefined) log(`Read ${name}: choose which column holds the review text`);
    else {
      const { summary } = buildReviews(file.rows, file.guess);
      log(kind === "sample" ? `Loaded the sample data (${plural(summary.used, "made-up review")})` : `Read ${name}: ${plural(summary.rowsRead, "row")}, ${plural(summary.used, "review")} used`);
    }
    return true;
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

  async function onSample() {
    setBusy({ name: "the sample data", stage: "checking", progress: 100 });
    try {
      const res = await fetch("/sample-reviews.csv");
      if (!res.ok) throw new Error("missing");
      if (load("sample", "sample-reviews.csv", await res.text(), null)) setView("overview");
    } catch {
      fail("Couldn't load the sample data. Check your connection and try again.");
    }
    setBusy(null);
  }

  function onColumn(field: keyof ReviewColumns, value: number | null) {
    setSource((cur) => {
      if (!cur) return cur;
      const next = { ...cur.columns };
      if (value === null) delete next[field];
      else next[field] = value;
      return { ...cur, columns: next };
    });
  }

  function leave(message: string) {
    setSource(null);
    setError(null);
    setTicks({});
    setView("upload");
    log(message);
  }

  // The home page links here with #sample to open the sample data straight away.
  useEffect(() => {
    if (window.location.hash === "#sample" && !autoSample.current) {
      autoSample.current = true;
      void Promise.resolve().then(onSample);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Each new screen starts at the top.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);

  const isSample = source?.kind === "sample";
  const goUpload = () => setView("upload");

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
          onViewResults={() => setView("overview")}
        />
      )}
      {view === "overview" && (
        <OverviewView
          analysis={analysis}
          priorities={priorities}
          summary={parsed?.summary ?? null}
          isSample={isSample}
          activity={activity}
          onGo={setView}
          onSample={onSample}
          onUseOwn={() => leave("Left the sample data")}
        />
      )}
      {view === "themes" && <ThemesView analysis={analysis} isSample={isSample} onGo={goUpload} onSample={onSample} onUseOwn={() => leave("Left the sample data")} />}
      {view === "plan" && (
        <ActionPlanView
          analysis={analysis}
          priorities={priorities}
          isSample={isSample}
          ticks={ticks}
          onToggle={(key) => setTicks((t) => ({ ...t, [key]: !t[key] }))}
          onGo={goUpload}
          onSample={onSample}
          onUseOwn={() => leave("Left the sample data")}
        />
      )}
    </AppShell>
  );
}
