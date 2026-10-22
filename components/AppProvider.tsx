"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import reviewsData from "@/data/reviews.json";
import { hashString } from "@/lib/sig";
import { useHydrated, usePersisted } from "@/lib/store";
import type { Insights } from "@/lib/insights";
import type { CustomRecords } from "@/lib/records";
import { DEMO_CLAIMS, DEMO_FIRST_REVIEW_ID } from "@/lib/demo";
import { DEMO_SETTINGS, normalizeSettings, type RestaurantSettings } from "@/lib/settings";
import type { CheckResponse, CheckResult, Claim, ReviewItem } from "@/lib/types";

export type Mode = "demo" | "own";
export type Tab = "dashboard" | "inbox" | "insights" | "records" | "restaurant";

export type Status = "new" | "checked" | "replied" | "reported";

export interface ReplyDraft {
  text: string;
  warning?: string;
  at: string;
  /** ai = tailored by the AI; own = ready-made text the owner edited */
  source?: "ai" | "own";
}

export interface Entry {
  status: Status;
  result?: CheckResult;
  sig?: string; // what the result was based on: review text plus the owner's records
  checkedAt?: string;
  note?: string; // e.g. "Doesn't look like a review"
  repliedAt?: string;
  reportedAt?: string;
  replies?: Record<string, ReplyDraft>; // saved reply drafts, by language/tone/approach
}

export interface QueueView {
  ids: string[]; // still waiting
  total: number;
  done: number;
  currentId: string | null;
  waitUntil: number | null;
  message: string;
  failures: { id: string; error: string }[];
  active: boolean;
}

export type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

interface AppValue {
  hydrated: boolean;
  reviews: ReviewItem[];
  entries: Record<string, Entry>;
  entryOf: (id: string) => Entry;
  isStale: (id: string) => boolean;
  setStatus: (id: string, status: Status) => void;
  setReply: (id: string, key: string, draft: ReplyDraft) => void;
  /** Removes a review the owner added, with its check and drafts. Demo reviews can't be deleted. */
  deleteReview: (id: string) => void;
  addReview: (r: { text: string; rating: number; date: string; author?: string; claims?: Claim[] }, opts?: { check?: boolean }) => string;
  check: (ids: string[], opts?: { force?: boolean }) => number;
  cancelQueue: () => void;
  queue: QueueView;
  customRecords: CustomRecords | null;
  setCustomRecords: (next: CustomRecords | null) => void;
  /** The owner's restaurant details. Null until they finish setup. */
  settings: RestaurantSettings | null;
  setSettings: (next: RestaurantSettings | null) => void;
  insights: Insights | null;
  insightsLoading: boolean;
  /** Waits until the free-tier limit allows another AI call. Use before any AI request. */
  acquireAi: () => Promise<void>;
  toast: (message: string, kind?: ToastKind) => void;
  anchorDate: Date;
  /** "demo" = the sample restaurant, "own" = the owner's restaurant, null = first visit. */
  mode: Mode | null;
  tab: Tab;
  setTab: (t: Tab) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  /** Loads the sample restaurant and opens Dan K.'s review with its case report already filled in. */
  startDemo: (opts?: { tour?: boolean }) => Promise<void>;
  /** Starts the owner's own setup (leaves the sample behind). */
  startSetup: () => void;
  finishSetup: (next: RestaurantSettings) => void;
  /** True once the owner has checked a first review or chosen to skip that step. */
  firstReviewDone: boolean;
  skipFirstReview: () => void;
  tourOpen: boolean;
  tourStep: number;
  setTourStep: (n: number) => void;
  startTour: () => void;
  endTour: () => void;
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
}

const Ctx = createContext<AppValue | null>(null);

export function useApp(): AppValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}

// Free tier: stay under about 5 AI calls a minute, and wait longer when the AI says it is busy.
const GAP_MS = 12_000;
const BUSY_WAIT_MS = 65_000;
const MAX_BUSY_RETRIES = 2;

const DEMO_REVIEWS: ReviewItem[] = (reviewsData as Omit<ReviewItem, "source">[]).map((r) => ({
  ...r,
  source: "demo" as const,
}));

const EMPTY_ENTRIES: Record<string, Entry> = {};
const EMPTY_ADDED: ReviewItem[] = [];
const NEW_ENTRY: Entry = { status: "new" };
const IDLE_QUEUE: QueueView = {
  ids: [],
  total: 0,
  done: 0,
  currentId: null,
  waitUntil: null,
  message: "",
  failures: [],
  active: false,
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function recordsSig(custom: CustomRecords | null, mode: Mode | null): string {
  if (custom) return `custom:${custom.orders?.length ?? 0}:${custom.ordersName}:${custom.reservations?.length ?? 0}:${custom.reservationsName}`;
  return mode === "own" ? "none" : "demo";
}

const reviewSig = (r: { text: string; rating: number; date: string }, ctx: string) =>
  hashString(`${r.text}|${r.rating}|${r.date}|${ctx}`);

const presetClaimsOf = (r: ReviewItem): Claim[] | undefined => r.claims ?? (r.source === "demo" ? DEMO_CLAIMS[r.id] : undefined);

export default function AppProvider({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const [added, setAdded] = usePersisted<ReviewItem[]>("dt-added-reviews-v1", EMPTY_ADDED);
  const [entries, setEntries] = usePersisted<Record<string, Entry>>("dt-entries-v1", EMPTY_ENTRIES);
  const [customRecords, setCustomRecords] = usePersisted<CustomRecords | null>("review-checker-records-v1", null);

  const [savedSettings, setSettings] = usePersisted<RestaurantSettings | null>("dt-settings-v1", null);
  const settings = useMemo(() => (savedSettings ? normalizeSettings(savedSettings) : null), [savedSettings]);

  // Which setup the owner is in. People who set up before this existed keep their data: the sample
  // restaurant's name means sample mode, anything else means their own restaurant.
  const [savedMode, setMode] = usePersisted<Mode | null>("dt-mode-v1", null);
  const mode: Mode | null = savedMode ?? (savedSettings ? (savedSettings.name === DEMO_SETTINGS.name ? "demo" : "own") : null);
  const [firstSkipped, setFirstSkipped] = usePersisted<boolean>("dt-first-skip-v1", false);
  const [, setTourSeen] = usePersisted<boolean>("dt-tour-seen-v1", false);

  const reviews = useMemo(
    () =>
      [...(mode === "demo" ? DEMO_REVIEWS : []), ...added.filter((r) => !r.workspace || r.workspace === (mode ?? "demo"))].sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    [added, mode],
  );
  // "This week" is measured from the newest review, so the demo data always has a current week.
  const anchorDate = useMemo(
    () => new Date(reviews.length ? Math.max(...reviews.map((r) => new Date(r.date).getTime())) : 0),
    [reviews],
  );

  const settingsSig = settings ? hashString(JSON.stringify(settings)) : "demo";
  const ctxSig = `${recordsSig(customRecords, mode)}|${settingsSig}`;
  const sigOf = useCallback((r: ReviewItem) => reviewSig(r, ctxSig), [ctxSig]);
  const firstReviewDone = firstSkipped || added.some((r) => r.workspace === "own");

  // ---- where the owner is in the app ----
  const [tab, setTab] = useState<Tab>("dashboard");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // ---- toasts ----
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);
  const toast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  // ---- latest values for the async queue ----
  const latest = useRef({ reviews, entries, customRecords, settings, sigOf, mode });
  useEffect(() => {
    latest.current = { reviews, entries, customRecords, settings, sigOf, mode };
  });

  const entryOf = useCallback((id: string): Entry => entries[id] ?? NEW_ENTRY, [entries]);

  const isStale = useCallback(
    (id: string) => {
      const e = entries[id];
      const r = reviews.find((x) => x.id === id);
      return !!(e?.result && r && e.sig !== sigOf(r));
    },
    [entries, reviews, sigOf],
  );

  const patchEntry = useCallback(
    (id: string, patch: Partial<Entry>) => {
      setEntries((prev) => ({ ...prev, [id]: { ...(prev[id] ?? NEW_ENTRY), ...patch } }));
    },
    [setEntries],
  );

  const setStatus = useCallback(
    (id: string, status: Status) => {
      const now = new Date().toISOString();
      patchEntry(id, {
        status,
        ...(status === "replied" ? { repliedAt: now } : {}),
        ...(status === "reported" ? { reportedAt: now } : {}),
      });
    },
    [patchEntry],
  );

  const setReply = useCallback(
    (id: string, key: string, draft: ReplyDraft) => {
      setEntries((prev) => {
        const old = prev[id] ?? NEW_ENTRY;
        return { ...prev, [id]: { ...old, replies: { ...(old.replies ?? {}), [key]: draft } } };
      });
    },
    [setEntries],
  );

  const autoCheck = useRef<string | null>(null);
  const addReview = useCallback(
    (r: { text: string; rating: number; date: string; author?: string; claims?: Claim[] }, opts?: { check?: boolean }) => {
      const id = `a-${Date.now().toString(36)}`;
      const item: ReviewItem = {
        id,
        author: r.author?.trim() || "Added review",
        rating: r.rating,
        date: r.date,
        text: r.text.trim(),
        source: "added",
        workspace: latest.current.mode ?? "demo",
        ...(r.claims ? { claims: r.claims } : {}),
      };
      setAdded((prev) => [...prev, item]);
      if (opts?.check) autoCheck.current = id;
      return id;
    },
    [setAdded],
  );

  // ---- the shared AI gate: one call at a time, never faster than GAP_MS ----
  const gate = useRef({ last: 0, chain: Promise.resolve() });
  const acquireAi = useCallback(() => {
    const g = gate.current;
    g.chain = g.chain.then(async () => {
      const wait = g.last + GAP_MS - Date.now();
      if (wait > 0) await sleep(wait);
      g.last = Date.now();
    });
    return g.chain;
  }, []);

  // ---- the check queue ----
  const work = useRef({ ids: [] as string[], total: 0, done: 0, running: false, cancelled: false, failures: [] as { id: string; error: string }[] });
  const [queue, setQueue] = useState<QueueView>(IDLE_QUEUE);

  const syncQueue = useCallback((patch: Partial<QueueView> = {}) => {
    const w = work.current;
    setQueue((prev) => ({
      ...prev,
      ids: [...w.ids],
      total: w.total,
      done: w.done,
      failures: [...w.failures],
      active: w.running,
      ...patch,
    }));
  }, []);

  const sleepVisible = useCallback(
    async (ms: number, message: string, currentId: string | null) => {
      const until = Date.now() + ms;
      syncQueue({ message, waitUntil: until, currentId });
      while (Date.now() < until && !work.current.cancelled) await sleep(250);
    },
    [syncQueue],
  );

  const runQueue = useCallback(async () => {
    const w = work.current;
    if (w.running) return;
    w.running = true;
    let busyRetries = 0;
    while (w.ids.length > 0 && !w.cancelled) {
      const id = w.ids[0];
      const { reviews: all, customRecords: custom, settings: owner, sigOf: sig, mode: nowMode } = latest.current;
      const review = all.find((r) => r.id === id);
      if (!review) {
        w.ids.shift();
        w.done++;
        continue;
      }
      const readyAt = Math.max(gate.current.last + GAP_MS, Date.now());
      if (!presetClaimsOf(review) && readyAt > Date.now() + 500) {
        syncQueue({
          message: "Waiting a few seconds to stay within the free AI limit",
          waitUntil: readyAt,
          currentId: id,
        });
      }
      // Sample and example reviews have their claims ready, so they don't use the AI or its free-tier gap.
      const preset = presetClaimsOf(review);
      if (!preset) await acquireAi();
      if (w.cancelled) break;
      syncQueue({ message: `Checking ${review.author}…`, waitUntil: null, currentId: id });

      let out: CheckResponse;
      try {
        const res = await fetch("/api/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: review.id,
            author: review.author,
            text: review.text,
            date: review.date,
            rating: review.rating,
            others: all
              .filter((o) => o.id !== review.id)
              .map((o) => ({ id: o.id, author: o.author, rating: o.rating, date: o.date, text: o.text })),
            ...(custom
              ? { records: { orders: custom.orders ?? [], reservations: custom.reservations ?? [] } }
              : nowMode === "own"
                ? { records: { orders: [], reservations: [] } }
                : {}),
            ...(owner ? { settings: owner } : {}),
            ...(preset ? { claims: preset } : {}),
          }),
        });
        out = (await res.json()) as CheckResponse;
      } catch {
        out = { ok: false, error: "The connection failed. Try again.", code: "unavailable" };
      }

      if (out.ok) {
        const now = new Date().toISOString();
        setEntries((prev) => {
          const old = prev[id] ?? NEW_ENTRY;
          return {
            ...prev,
            [id]: {
              ...old,
              status: old.status === "replied" || old.status === "reported" ? old.status : "checked",
              result: out.ok ? out.result : old.result,
              sig: sig(review),
              checkedAt: now,
              note: undefined,
            },
          };
        });
        w.ids.shift();
        w.done++;
        busyRetries = 0;
      } else if (out.code === "busy" && busyRetries < MAX_BUSY_RETRIES) {
        busyRetries++;
        gate.current.last = Date.now();
        await sleepVisible(BUSY_WAIT_MS, "The AI is busy. Waiting a minute, then trying again", id);
      } else if (out.code === "no_key") {
        w.failures.push({ id, error: out.error });
        w.ids = [];
        break;
      } else {
        if (out.ok === false && out.notReview) patchEntry(id, { note: "Doesn't look like a review" });
        w.failures.push({ id, error: out.error });
        w.ids.shift();
        w.done++;
        busyRetries = 0;
      }
      syncQueue({ waitUntil: null });
    }
    const finished = w.done - w.failures.length;
    const failed = w.failures.length;
    w.running = false;
    w.cancelled = false;
    w.ids = [];
    syncQueue({ message: "", waitUntil: null, currentId: null });
    if (finished > 0 && failed === 0) toast(`Checked ${finished} review${finished === 1 ? "" : "s"}`, "success");
    else if (failed > 0) toast(`Checked ${finished}. ${failed} failed: ${w.failures[0].error}`, "error");
  }, [acquireAi, patchEntry, setEntries, sleepVisible, syncQueue, toast]);

  const check = useCallback(
    (ids: string[], opts: { force?: boolean } = {}) => {
      const w = work.current;
      const { reviews: all, entries: ents, sigOf: sig } = latest.current;
      const eligible = ids.filter((id) => {
        if (w.ids.includes(id)) return false;
        const review = all.find((r) => r.id === id);
        if (!review) return false;
        const e = ents[id];
        return opts.force || !e?.result || e.sig !== sig(review);
      });
      if (eligible.length === 0) return 0;
      if (!w.running) {
        w.total = 0;
        w.done = 0;
        w.failures = [];
      }
      w.ids.push(...eligible);
      w.total += eligible.length;
      syncQueue();
      void runQueue();
      return eligible.length;
    },
    [runQueue, syncQueue],
  );

  // A review added with { check: true } is checked as soon as it shows up in the list.
  useEffect(() => {
    const id = autoCheck.current;
    if (id && reviews.some((r) => r.id === id)) {
      autoCheck.current = null;
      check([id]);
    }
  }, [reviews, check]);

  const cancelQueue = useCallback(() => {
    const w = work.current;
    w.cancelled = true;
    w.ids = [];
    syncQueue({ message: "Stopping…" });
  }, [syncQueue]);

  const deleteReview = useCallback(
    (id: string) => {
      const w = work.current;
      if (w.ids.includes(id)) {
        w.ids = w.ids.filter((x) => x !== id);
        syncQueue();
      }
      setAdded((prev) => prev.filter((r) => r.id !== id));
      setEntries((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [setAdded, setEntries, syncQueue],
  );

  // ---- quick screens, themes and so on, computed by the server from the saved reviews ----
  const [insights, setInsights] = useState<Insights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const insightsBody = useMemo(
    () =>
      JSON.stringify({
        reviews: reviews.map((r) => ({ id: r.id, author: r.author, rating: r.rating, date: r.date, text: r.text })),
        ...(customRecords
          ? { records: { orders: customRecords.orders ?? [], reservations: customRecords.reservations ?? [] } }
          : mode === "own"
            ? { records: { orders: [], reservations: [] } }
            : {}),
        ...(settings ? { settings } : {}),
      }),
    [reviews, customRecords, settings, mode],
  );
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    fetch("/api/insights", { method: "POST", headers: { "Content-Type": "application/json" }, body: insightsBody })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.ok) setInsights(j.insights as Insights);
        setInsightsLoading(false);
      })
      .catch(() => !cancelled && setInsightsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [insightsBody, hydrated]);

  // ---- sample data, setup, tour ----
  const startTour = useCallback(() => {
    setTab("inbox");
    setTourStep(0);
    setTourOpen(true);
  }, []);
  const endTour = useCallback(() => {
    setTourOpen(false);
    setTourSeen(true);
  }, [setTourSeen]);

  /** Fills in the sample reviews' case reports from their saved claims. The checks run in code; no AI call. */
  const startDemo = useCallback(
    async (opts: { tour?: boolean } = {}) => {
      const demoSettings = normalizeSettings(DEMO_SETTINGS);
      const ctx = `demo|${hashString(JSON.stringify(demoSettings))}`;
      const others = DEMO_REVIEWS.map((o) => ({ id: o.id, author: o.author, rating: o.rating, date: o.date, text: o.text }));
      const seeded: Record<string, Entry> = {};
      await Promise.all(
        DEMO_REVIEWS.filter((r) => DEMO_CLAIMS[r.id]).map(async (r) => {
          try {
            const res = await fetch("/api/check", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: r.id,
                author: r.author,
                text: r.text,
                date: r.date,
                rating: r.rating,
                others: others.filter((o) => o.id !== r.id),
                settings: demoSettings,
                claims: DEMO_CLAIMS[r.id],
              }),
            });
            const out = (await res.json()) as CheckResponse;
            if (out.ok) seeded[r.id] = { status: "checked", result: out.result, sig: reviewSig(r, ctx), checkedAt: new Date().toISOString() };
          } catch {
            // The review can still be checked later from the inbox.
          }
        }),
      );
      work.current.ids = [];
      setMode("demo");
      setCustomRecords(null);
      setSettings(DEMO_SETTINGS);
      setAdded([]);
      setEntries(seeded);
      setTab("inbox");
      setSelectedId(DEMO_FIRST_REVIEW_ID);
      if (pathname !== "/") router.push("/");
      if (opts.tour !== false) {
        setTourStep(0);
        setTourOpen(true);
      }
    },
    [pathname, router, setAdded, setCustomRecords, setEntries, setMode, setSettings],
  );

  const startSetup = useCallback(() => {
    work.current.ids = [];
    setTourOpen(false);
    setMode("own");
    setSettings(null);
    setCustomRecords(null);
    setAdded([]);
    setEntries({});
    setSelectedId(null);
    setTab("dashboard");
    if (pathname !== "/") router.push("/");
  }, [pathname, router, setAdded, setCustomRecords, setEntries, setMode, setSettings]);

  const finishSetup = useCallback(
    (next: RestaurantSettings) => {
      setMode("own");
      setSettings(next);
    },
    [setMode, setSettings],
  );

  const value: AppValue = {
    hydrated,
    reviews,
    entries,
    entryOf,
    isStale,
    setStatus,
    setReply,
    deleteReview,
    addReview,
    check,
    cancelQueue,
    queue,
    customRecords,
    setCustomRecords,
    settings,
    setSettings,
    insights,
    insightsLoading,
    acquireAi,
    toast,
    anchorDate,
    mode,
    tab,
    setTab,
    selectedId,
    setSelectedId,
    startDemo,
    startSetup,
    finishSetup,
    firstReviewDone,
    skipFirstReview: () => setFirstSkipped(true),
    tourOpen,
    tourStep,
    setTourStep,
    startTour,
    endTour,
    helpOpen,
    setHelpOpen,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`} role="status">
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
