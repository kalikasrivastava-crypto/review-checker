"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { hashString } from "@/lib/sig";
import { supabase, authedPost } from "@/lib/supabase-browser";
import { usePersisted } from "@/lib/store";
import type { Insights } from "@/lib/insights";
import type { Order, Reservation } from "@/lib/records";
import { checkSignature, normalizeSettings, type RestaurantSettings } from "@/lib/settings";
import type { CheckResponse, CheckResult, ReviewItem } from "@/lib/types";

export type Tab = "dashboard" | "inbox" | "feedback" | "insights" | "records" | "restaurant";

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
  sig?: string; // what the result was based on: the review, the restaurant's settings and its records
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

export interface Restaurant {
  id: string;
  slug: string;
  name: string;
  googleReviewUrl: string;
  isDemo: boolean;
  recordsVersion: number;
  billsFile: string;
  reservationsFile: string;
  settings: RestaurantSettings;
}

export interface Feedback {
  id: string;
  rating: number;
  visitDate: string | null;
  visitTime: string | null;
  partySize: number | null;
  billNo: string | null;
  comment: string;
  name: string | null;
  phone: string | null;
  verified: boolean;
  status: "new" | "contacted" | "closed";
  createdAt: string;
}

/** A file the owner uploaded (or a whole new setup's worth of them). */
export interface RecordsInput {
  orders?: Order[] | null;
  ordersName?: string;
  reservations?: Reservation[] | null;
  reservationsName?: string;
}

interface AppValue {
  /** True once we know who is signed in and, if someone is, their restaurant's data has loaded. */
  hydrated: boolean;
  auth: "loading" | "out" | "in";
  userEmail: string;
  authMode: "login" | "signup";
  setAuthMode: (m: "login" | "signup") => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<{ error?: string; needsConfirm?: boolean }>;
  signOut: () => Promise<void>;
  restaurant: Restaurant | null;
  isDemo: boolean;
  reviews: ReviewItem[];
  entries: Record<string, Entry>;
  entryOf: (id: string) => Entry;
  isStale: (id: string) => boolean;
  setStatus: (id: string, status: Status) => void;
  setReply: (id: string, key: string, draft: ReplyDraft) => void;
  /** Removes a review the owner added, with its check and drafts. Sample reviews can't be deleted. */
  deleteReview: (id: string) => void;
  addReview: (
    r: { text: string; rating: number; date: string; author?: string; claims?: unknown[] },
    opts?: { check?: boolean },
  ) => Promise<string | null>;
  check: (ids: string[], opts?: { force?: boolean }) => number;
  cancelQueue: () => void;
  queue: QueueView;
  recordCounts: { bills: number; reservations: number };
  saveRecords: (input: RecordsInput) => Promise<boolean>;
  clearRecords: () => Promise<void>;
  /** The restaurant's details. Null until the owner finishes setup. */
  settings: RestaurantSettings | null;
  saveSettings: (next: RestaurantSettings, googleReviewUrl?: string) => Promise<boolean>;
  createRestaurant: (next: RestaurantSettings, records?: RecordsInput, googleReviewUrl?: string) => Promise<boolean>;
  resetDemo: () => Promise<void>;
  feedback: Feedback[];
  setFeedbackStatus: (id: string, status: Feedback["status"]) => void;
  insights: Insights | null;
  insightsLoading: boolean;
  /** Waits until the free-tier limit allows another AI call. Use before any AI request. */
  acquireAi: () => Promise<void>;
  toast: (message: string, kind?: ToastKind) => void;
  anchorDate: Date;
  tab: Tab;
  setTab: (t: Tab) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
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
const NO_COUNTS = { bills: 0, reservations: 0 };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Sends a database write. (The database library only sends a request once something waits on it.) */
function send(query: PromiseLike<{ error: unknown }>, onError: () => void) {
  void query.then(
    (res) => {
      if (res.error) onError();
    },
    onError,
  );
}

// ---- what the database rows look like ----
interface ReviewRow {
  id: string;
  restaurant_id: string;
  demo_key: string | null;
  author: string;
  rating: number;
  date: string;
  text: string;
  source: "demo" | "added";
  status: Status;
  note: string | null;
  replied_at: string | null;
  reported_at: string | null;
  claims: unknown[] | null;
}
interface ReportRow {
  review_id: string;
  result: CheckResult;
  sig: string;
  checked_at: string;
}
interface ReplyRow {
  review_id: string;
  key: string;
  text: string;
  warning: string | null;
  source: string | null;
  at: string;
}
interface FeedbackRow {
  id: string;
  rating: number;
  visit_date: string | null;
  visit_time: string | null;
  party_size: number | null;
  bill_no: string | null;
  comment: string;
  name: string | null;
  phone: string | null;
  verified_visit: boolean;
  status: Feedback["status"];
  created_at: string;
}
interface RestaurantRow {
  id: string;
  slug: string;
  name: string;
  google_review_url: string;
  is_demo: boolean;
  records_version: number;
  bills_file: string;
  reservations_file: string;
  settings: RestaurantSettings;
}

const toRestaurant = (r: RestaurantRow): Restaurant => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  googleReviewUrl: r.google_review_url,
  isDemo: r.is_demo,
  recordsVersion: Number(r.records_version),
  billsFile: r.bills_file,
  reservationsFile: r.reservations_file,
  settings: normalizeSettings(r.settings),
});

const toFeedback = (f: FeedbackRow): Feedback => ({
  id: f.id,
  rating: f.rating,
  visitDate: f.visit_date,
  visitTime: f.visit_time,
  partySize: f.party_size,
  billNo: f.bill_no,
  comment: f.comment,
  name: f.name,
  phone: f.phone,
  verified: f.verified_visit,
  status: f.status,
  createdAt: f.created_at,
});

const toReply = (r: ReplyRow): ReplyDraft => ({
  text: r.text,
  warning: r.warning ?? undefined,
  at: r.at,
  source: r.source === "ai" ? "ai" : "own",
});

const hasSavedClaims = (r: ReviewRow) => Array.isArray(r.claims) && r.claims.length > 0;

function friendlyAuthError(message: string): string {
  if (/invalid login/i.test(message)) return "That email or password isn't right.";
  if (/not confirmed/i.test(message)) return "Please confirm your email first. Check your inbox for the link.";
  if (/already registered|already been registered/i.test(message)) return "That email already has an account. Try logging in.";
  if (/password/i.test(message)) return "Choose a password with at least 8 characters.";
  if (/rate limit|too many/i.test(message)) return "Too many tries. Wait a minute and try again.";
  return "Something went wrong. Try again.";
}

/** Inserts rows in batches (the database accepts a few hundred at a time comfortably). */
async function insertBatches(table: string, rows: Record<string, unknown>[]): Promise<boolean> {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase().from(table).insert(rows.slice(i, i + 500));
    if (error) return false;
  }
  return true;
}

export default function AppProvider({ children }: { children: React.ReactNode }) {
  // ---- who is signed in ----
  const [auth, setAuth] = useState<"loading" | "out" | "in">("loading");
  const [user, setUser] = useState<{ id: string; email: string; demo: boolean } | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  useEffect(() => {
    const sb = supabase();
    const apply = (session: { user: { id: string; email?: string; user_metadata?: Record<string, unknown> } } | null) => {
      if (session) {
        setUser((prev) =>
          prev?.id === session.user.id
            ? prev
            : { id: session.user.id, email: session.user.email ?? "", demo: session.user.user_metadata?.demo === true },
        );
        setAuth("in");
      } else {
        setUser(null);
        setAuth("out");
      }
    };
    void sb.auth.getSession().then(({ data }) => apply(data.session));
    // Only record the change here; loading data happens in an effect (calling Supabase from inside this callback can deadlock).
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => apply(session));
    return () => sub.subscription.unsubscribe();
  }, []);

  // ---- the restaurant's data, all read from the database ----
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [reports, setReports] = useState<Record<string, ReportRow>>({});
  const [replyRows, setReplyRows] = useState<Record<string, Record<string, ReplyDraft>>>({});
  const [feedbackRows, setFeedbackRows] = useState<FeedbackRow[]>([]);
  const [recordCounts, setRecordCounts] = useState(NO_COUNTS);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("dashboard");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [, setTourSeen] = usePersisted<boolean>("dt-tour-seen-v1", false);
  const [firstSkipped, setFirstSkipped] = usePersisted<boolean>(`dt-first-skip-${user?.id ?? "none"}`, false);

  // ---- toasts ----
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);
  const toast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const settings = useMemo(() => restaurant?.settings ?? null, [restaurant]);
  const recordsVersion = restaurant?.recordsVersion ?? 0;

  const reviews = useMemo<ReviewItem[]>(
    () =>
      reviewRows
        .map((r) => ({
          id: r.id,
          author: r.author,
          rating: r.rating,
          date: r.date,
          text: r.text,
          source: r.source,
          hasClaims: hasSavedClaims(r),
        }))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [reviewRows],
  );

  const entries = useMemo(() => {
    const out: Record<string, Entry> = {};
    for (const r of reviewRows) {
      const rep = reports[r.id];
      out[r.id] = {
        status: r.status,
        result: rep?.result,
        sig: rep?.sig,
        checkedAt: rep?.checked_at,
        note: r.note ?? undefined,
        repliedAt: r.replied_at ?? undefined,
        reportedAt: r.reported_at ?? undefined,
        replies: replyRows[r.id],
      };
    }
    return out;
  }, [reviewRows, reports, replyRows]);

  const feedback = useMemo(() => feedbackRows.map(toFeedback), [feedbackRows]);

  // "This week" is measured from the newest review, so the sample data always has a current week.
  const anchorDate = useMemo(
    () => new Date(reviews.length ? Math.max(...reviews.map((r) => new Date(r.date).getTime())) : 0),
    [reviews],
  );

  const sigOf = useCallback(
    (r: ReviewItem) => (settings ? checkSignature(r, settings, recordsVersion) : ""),
    [settings, recordsVersion],
  );

  const latest = useRef({ reviews, entries, sigOf, restaurant });
  useEffect(() => {
    latest.current = { reviews, entries, sigOf, restaurant };
  });

  // ---- loading ----
  const loadAll = useCallback(async (): Promise<{ restaurant: Restaurant | null; reviews: ReviewRow[] }> => {
    const sb = supabase();
    const { data: r } = await sb.from("restaurants").select("*").limit(1).maybeSingle();
    if (!r) {
      setRestaurant(null);
      setReviewRows([]);
      setReports({});
      setReplyRows({});
      setFeedbackRows([]);
      setRecordCounts(NO_COUNTS);
      return { restaurant: null, reviews: [] };
    }
    const rid = (r as RestaurantRow).id;
    const [rv, cr, rp, fb, bc, rc] = await Promise.all([
      sb.from("reviews").select("*").eq("restaurant_id", rid).limit(1000),
      sb.from("case_reports").select("review_id,result,sig,checked_at").eq("restaurant_id", rid).limit(1000),
      sb.from("replies").select("review_id,key,text,warning,source,at").eq("restaurant_id", rid).limit(1000),
      sb.from("customer_feedback").select("*").eq("restaurant_id", rid).order("created_at", { ascending: false }).limit(500),
      sb.from("bills").select("id", { count: "exact", head: true }).eq("restaurant_id", rid),
      sb.from("reservations").select("id", { count: "exact", head: true }).eq("restaurant_id", rid),
    ]);
    const rest = toRestaurant(r as RestaurantRow);
    const rows = (rv.data ?? []) as ReviewRow[];
    setRestaurant(rest);
    setReviewRows(rows);
    setReports(Object.fromEntries(((cr.data ?? []) as ReportRow[]).map((x) => [x.review_id, x])));
    const grouped: Record<string, Record<string, ReplyDraft>> = {};
    for (const x of (rp.data ?? []) as ReplyRow[]) (grouped[x.review_id] ??= {})[x.key] = toReply(x);
    setReplyRows(grouped);
    setFeedbackRows((fb.data ?? []) as FeedbackRow[]);
    setRecordCounts({ bills: bc.count ?? 0, reservations: rc.count ?? 0 });
    return { restaurant: rest, reviews: rows };
  }, []);

  const callCheck = useCallback(async (reviewId: string): Promise<CheckResponse> => {
    try {
      const res = await authedPost("/api/check", { reviewId });
      return (await res.json()) as CheckResponse;
    } catch {
      return { ok: false, error: "The connection failed. Try again.", code: "unavailable" };
    }
  }, []);

  const applyReport = useCallback((id: string, out: Extract<CheckResponse, { ok: true }>) => {
    setReports((prev) => ({
      ...prev,
      [id]: { review_id: id, result: out.result, sig: out.sig ?? "", checked_at: out.checkedAt ?? new Date().toISOString() },
    }));
    setReviewRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, note: null, status: r.status === "replied" || r.status === "reported" ? r.status : "checked" } : r,
      ),
    );
  }, []);

  // Sample reviews carry saved claims, so their case reports are made at once with no AI call.
  const seedReports = useCallback(
    async (rows: ReviewRow[]) => {
      await Promise.all(
        rows.filter(hasSavedClaims).map(async (r) => {
          const out = await callCheck(r.id);
          if (out.ok) applyReport(r.id, out);
        }),
      );
    },
    [applyReport, callCheck],
  );

  const userId = user?.id ?? null;
  const userIsDemo = user?.demo ?? false;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      let loaded = await loadAll();
      let startedDemo = false;
      let wantsDemo = false;
      try {
        wantsDemo = localStorage.getItem("dt-start-demo") === "1";
      } catch {
        // no storage: no guided demo start
      }
      // A visitor who pressed "Try demo": give their throwaway account its own copy of the Demo Restaurant.
      if (!loaded.restaurant && wantsDemo && userIsDemo) {
        const { error } = await supabase().rpc("seed_demo_restaurant");
        if (!error) {
          loaded = await loadAll();
          startedDemo = true;
        }
      }
      if (wantsDemo) {
        try {
          localStorage.removeItem("dt-start-demo");
        } catch {
          // ignore
        }
      }
      if (cancelled) return;
      if (startedDemo) {
        await seedReports(loaded.reviews);
        const first = loaded.reviews.find((r) => r.demo_key === "m1");
        if (first) setSelectedId(first.id);
        setTab("inbox");
        setTourStep(0);
        setTourOpen(true);
      }
      if (!cancelled) setLoadedFor(userId);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, userIsDemo, loadAll, seedReports]);

  const loaded = !!userId && loadedFor === userId;
  const hydrated = auth === "out" || (auth === "in" && loaded);

  // ---- live updates: anything that changes in the database shows up at once ----
  const restaurantId = restaurant?.id ?? null;
  const pendingReplies = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    if (!restaurantId) return;
    const sb = supabase();
    const filter = `restaurant_id=eq.${restaurantId}`;
    const channel = sb
      .channel(`restaurant-${restaurantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews", filter }, (p) => {
        if (p.eventType === "DELETE") {
          const id = (p.old as { id?: string }).id;
          if (id) setReviewRows((prev) => prev.filter((r) => r.id !== id));
        } else {
          const row = p.new as ReviewRow;
          setReviewRows((prev) => (prev.some((r) => r.id === row.id) ? prev.map((r) => (r.id === row.id ? { ...r, ...row } : r)) : [...prev, row]));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "case_reports", filter }, (p) => {
        if (p.eventType === "DELETE") {
          const id = (p.old as { review_id?: string }).review_id;
          if (id)
            setReports((prev) => {
              const next = { ...prev };
              delete next[id];
              return next;
            });
        } else {
          const row = p.new as ReportRow;
          setReports((prev) => ({ ...prev, [row.review_id]: row }));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "replies", filter }, (p) => {
        const row = (p.eventType === "DELETE" ? p.old : p.new) as ReplyRow;
        if (!row?.review_id || !row.key) return;
        // Don't overwrite what the owner is typing right now with an older saved copy.
        if (pendingReplies.current.has(`${row.review_id}|${row.key}`)) return;
        setReplyRows((prev) => {
          const forReview = { ...(prev[row.review_id] ?? {}) };
          if (p.eventType === "DELETE") delete forReview[row.key];
          else forReview[row.key] = toReply(row);
          return { ...prev, [row.review_id]: forReview };
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_feedback", filter }, (p) => {
        if (p.eventType === "DELETE") {
          const id = (p.old as { id?: string }).id;
          if (id) setFeedbackRows((prev) => prev.filter((f) => f.id !== id));
        } else {
          const row = p.new as FeedbackRow;
          setFeedbackRows((prev) => {
            if (prev.some((f) => f.id === row.id)) return prev.map((f) => (f.id === row.id ? row : f));
            return [row, ...prev];
          });
          if (p.eventType === "INSERT") toast(`New guest feedback: ${row.rating} star${row.rating === 1 ? "" : "s"}`, "info");
        }
      })
      .subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  }, [restaurantId, toast]);

  // ---- the check queue (declared before the actions that use it) ----
  const work = useRef({ ids: [] as string[], total: 0, done: 0, running: false, cancelled: false, failures: [] as { id: string; error: string }[] });
  const [queue, setQueue] = useState<QueueView>(IDLE_QUEUE);

  // ---- sign in, sign up, sign out ----
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    return error ? friendlyAuthError(error.message) : null;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase().auth.signUp({ email: email.trim(), password });
    if (error) return { error: friendlyAuthError(error.message) };
    return data.session ? {} : { needsConfirm: true };
  }, []);

  const signOut = useCallback(async () => {
    work.current.ids = [];
    await supabase().auth.signOut();
    setRestaurant(null);
    setReviewRows([]);
    setSelectedId(null);
    setTab("dashboard");
    setTourOpen(false);
  }, []);

  // ---- reviews, statuses and replies ----
  const entryOf = useCallback((id: string): Entry => entries[id] ?? NEW_ENTRY, [entries]);

  const isStale = useCallback(
    (id: string) => {
      const e = entries[id];
      const r = reviews.find((x) => x.id === id);
      return !!(e?.result && r && e.sig !== sigOf(r));
    },
    [entries, reviews, sigOf],
  );

  const setStatus = useCallback((id: string, status: Status) => {
    const now = new Date().toISOString();
    const patch = {
      status,
      ...(status === "replied" ? { replied_at: now } : {}),
      ...(status === "reported" ? { reported_at: now } : {}),
    };
    setReviewRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    send(supabase().from("reviews").update(patch).eq("id", id), () => toast("Couldn't save that change. Check your connection.", "error"));
  }, [toast]);

  const setReply = useCallback((id: string, key: string, draft: ReplyDraft) => {
    setReplyRows((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), [key]: draft } }));
    // The owner types freely, so save a moment after they pause rather than on every key.
    const k = `${id}|${key}`;
    clearTimeout(pendingReplies.current.get(k));
    pendingReplies.current.set(
      k,
      setTimeout(() => {
        pendingReplies.current.delete(k);
        const rid = latest.current.restaurant?.id;
        if (!rid) return;
        send(
          supabase()
            .from("replies")
            .upsert(
              { review_id: id, restaurant_id: rid, key, text: draft.text, warning: draft.warning ?? null, source: draft.source ?? "own", at: draft.at },
              { onConflict: "review_id,key" },
            ),
          () => toast("Couldn't save your reply draft. Check your connection.", "error"),
        );
      }, 700),
    );
  }, [toast]);

  const autoCheck = useRef<string | null>(null);
  const addReview = useCallback(
    async (r: { text: string; rating: number; date: string; author?: string; claims?: unknown[] }, opts?: { check?: boolean }) => {
      const rid = latest.current.restaurant?.id;
      if (!rid) return null;
      const text = r.text.trim();
      const { data, error } = await supabase()
        .from("reviews")
        .insert({
          restaurant_id: rid,
          author: r.author?.trim() || "Added review",
          rating: r.rating,
          date: r.date,
          text,
          source: "added",
          ...(r.claims ? { claims: r.claims, claims_hash: hashString(text) } : {}),
        })
        .select("*")
        .single();
      if (error || !data) {
        toast("Couldn't save that review. Try again.", "error");
        return null;
      }
      const row = data as ReviewRow;
      setReviewRows((prev) => (prev.some((x) => x.id === row.id) ? prev : [...prev, row]));
      if (opts?.check) autoCheck.current = row.id;
      return row.id;
    },
    [toast],
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
      const review = latest.current.reviews.find((r) => r.id === id);
      if (!review) {
        w.ids.shift();
        w.done++;
        continue;
      }
      // Reviews with saved claims don't use the AI, so they skip the free-tier gap.
      const needsAi = !review.hasClaims;
      const readyAt = Math.max(gate.current.last + GAP_MS, Date.now());
      if (needsAi && readyAt > Date.now() + 500) {
        syncQueue({ message: "Waiting a few seconds to stay within the free AI limit", waitUntil: readyAt, currentId: id });
      }
      if (needsAi) await acquireAi();
      if (w.cancelled) break;
      syncQueue({ message: `Checking ${review.author}…`, waitUntil: null, currentId: id });

      const out = await callCheck(id);
      if (out.ok) {
        applyReport(id, out);
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
        if (out.ok === false && out.notReview) {
          setReviewRows((prev) => prev.map((r) => (r.id === id ? { ...r, note: "Doesn't look like a review" } : r)));
        }
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
  }, [acquireAi, applyReport, callCheck, sleepVisible, syncQueue, toast]);

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
      setReviewRows((prev) => prev.filter((r) => r.id !== id));
      send(supabase().from("reviews").delete().eq("id", id), () => toast("Couldn't delete that review. Try again.", "error"));
    },
    [syncQueue, toast],
  );

  // ---- records (bills and reservations) ----
  const saveRecords = useCallback(
    async (input: RecordsInput): Promise<boolean> => {
      const rest = latest.current.restaurant;
      if (!rest) return false;
      const sb = supabase();
      const version = Date.now();
      const patch: Record<string, unknown> = { records_version: version, updated_at: new Date().toISOString() };
      let bills = recordCounts.bills;
      let reservations = recordCounts.reservations;
      if (input.orders) {
        const del = await sb.from("bills").delete().eq("restaurant_id", rest.id);
        const ok =
          !del.error &&
          (await insertBatches(
            "bills",
            input.orders.map((o) => ({ restaurant_id: rest.id, bill_no: o.billId, date: o.date, minutes: o.minutes, party_size: o.partySize, items: o.items })),
          ));
        if (!ok) return false;
        patch.bills_file = input.ordersName ?? "";
        bills = input.orders.length;
      }
      if (input.reservations) {
        const del = await sb.from("reservations").delete().eq("restaurant_id", rest.id);
        const ok =
          !del.error &&
          (await insertBatches(
            "reservations",
            input.reservations.map((o) => ({ restaurant_id: rest.id, ref: o.ref, date: o.date, minutes: o.minutes, party_size: o.partySize })),
          ));
        if (!ok) return false;
        patch.reservations_file = input.reservationsName ?? "";
        reservations = input.reservations.length;
      }
      const { error } = await sb.from("restaurants").update(patch).eq("id", rest.id);
      if (error) return false;
      setRestaurant((prev) =>
        prev
          ? {
              ...prev,
              recordsVersion: version,
              billsFile: (patch.bills_file as string | undefined) ?? prev.billsFile,
              reservationsFile: (patch.reservations_file as string | undefined) ?? prev.reservationsFile,
            }
          : prev,
      );
      setRecordCounts({ bills, reservations });
      return true;
    },
    [recordCounts],
  );

  const clearRecords = useCallback(async () => {
    const rest = latest.current.restaurant;
    if (!rest) return;
    const sb = supabase();
    await sb.from("bills").delete().eq("restaurant_id", rest.id);
    await sb.from("reservations").delete().eq("restaurant_id", rest.id);
    const version = Date.now();
    await sb.from("restaurants").update({ records_version: version, bills_file: "", reservations_file: "", updated_at: new Date().toISOString() }).eq("id", rest.id);
    setRestaurant((prev) => (prev ? { ...prev, recordsVersion: version, billsFile: "", reservationsFile: "" } : prev));
    setRecordCounts(NO_COUNTS);
  }, []);

  // ---- restaurant details ----
  const saveSettings = useCallback(async (next: RestaurantSettings, googleReviewUrl?: string): Promise<boolean> => {
    const rest = latest.current.restaurant;
    if (!rest) return false;
    const patch = {
      name: next.name.trim(),
      phone: next.phone,
      email: next.email,
      settings: next,
      ...(googleReviewUrl !== undefined ? { google_review_url: googleReviewUrl.trim() } : {}),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase().from("restaurants").update(patch).eq("id", rest.id);
    if (error) return false;
    setRestaurant((prev) =>
      prev ? { ...prev, name: patch.name, settings: normalizeSettings(next), googleReviewUrl: patch.google_review_url ?? prev.googleReviewUrl } : prev,
    );
    return true;
  }, []);

  const createRestaurant = useCallback(
    async (next: RestaurantSettings, records?: RecordsInput, googleReviewUrl = ""): Promise<boolean> => {
      const sb = supabase();
      const { data, error } = await sb.rpc("create_restaurant", { p_settings: next, p_google: googleReviewUrl });
      if (error || !data) return false;
      const created = toRestaurant(data as RestaurantRow);
      latest.current.restaurant = created;
      setRestaurant(created);
      if (records && (records.orders || records.reservations)) await saveRecords(records);
      await loadAll();
      return true;
    },
    [loadAll, saveRecords],
  );

  const resetDemo = useCallback(async () => {
    const { error } = await supabase().rpc("reset_demo");
    if (error) {
      toast("Couldn't reset the sample data. Try again.", "error");
      return;
    }
    work.current.ids = [];
    const again = await loadAll();
    await seedReports(again.reviews);
    const first = again.reviews.find((r) => r.demo_key === "m1");
    setSelectedId(first?.id ?? null);
    setTab("inbox");
    toast("Back to the sample data", "success");
  }, [loadAll, seedReports, toast]);

  const setFeedbackStatus = useCallback((id: string, status: Feedback["status"]) => {
    setFeedbackRows((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
    send(supabase().from("customer_feedback").update({ status }).eq("id", id), () => toast("Couldn't save that change. Check your connection.", "error"));
  }, [toast]);

  // ---- quick screens, themes and so on, computed by the server from the saved reviews ----
  const [insights, setInsights] = useState<Insights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const settingsKey = settings ? hashString(JSON.stringify(settings)) : "";
  const reviewsKey = reviews.map((r) => r.id).join(",");
  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    void authedPost("/api/insights", {})
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
  }, [restaurantId, recordsVersion, settingsKey, reviewsKey]);

  const startTour = useCallback(() => {
    setTab("inbox");
    setTourStep(0);
    setTourOpen(true);
  }, []);
  const endTour = useCallback(() => {
    setTourOpen(false);
    setTourSeen(true);
  }, [setTourSeen]);

  const isDemo = restaurant?.isDemo ?? false;
  const firstReviewDone = firstSkipped || reviewRows.some((r) => r.source === "added");

  const value: AppValue = {
    hydrated,
    auth,
    userEmail: user?.email ?? "",
    authMode,
    setAuthMode,
    signIn,
    signUp,
    signOut,
    restaurant,
    isDemo,
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
    recordCounts,
    saveRecords,
    clearRecords,
    settings,
    saveSettings,
    createRestaurant,
    resetDemo,
    feedback,
    setFeedbackStatus,
    insights: restaurantId ? insights : null,
    insightsLoading,
    acquireAi,
    toast,
    anchorDate,
    tab,
    setTab,
    selectedId,
    setSelectedId,
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
