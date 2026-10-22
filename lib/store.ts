"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Tiny saved-state store. Values live in localStorage (so they survive a refresh) and are mirrored in
 * memory, so the app still works if storage is blocked or full. Every hook using the same key updates together.
 */
const listeners = new Set<() => void>();
const raws = new Map<string, string | null>();
const parsed = new Map<string, { raw: string | null; value: unknown }>();
let listening = false;

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function notify() {
  listeners.forEach((l) => l());
}

function getValue<T>(key: string, fallback: T): T {
  if (!raws.has(key)) raws.set(key, safeGet(key));
  const raw = raws.get(key) ?? null;
  const cached = parsed.get(key);
  if (cached && cached.raw === raw) return cached.value as T;
  let value = fallback;
  if (raw) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = fallback;
    }
  }
  parsed.set(key, { raw, value });
  return value;
}

function setValue<T>(key: string, value: T | null) {
  const raw = value === null ? null : JSON.stringify(value);
  raws.set(key, raw);
  try {
    if (raw === null) localStorage.removeItem(key);
    else localStorage.setItem(key, raw);
  } catch {
    // storage full or blocked: keep it in memory for this visit
  }
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!listening && typeof window !== "undefined") {
    listening = true;
    window.addEventListener("storage", (e) => {
      if (e.key) raws.delete(e.key);
      notify();
    });
  }
  return () => listeners.delete(listener);
}

/** `fallback` must be a stable value (a module constant), not a new object on every render. */
export function usePersisted<T>(key: string, fallback: T) {
  const value = useSyncExternalStore(
    subscribe,
    () => getValue(key, fallback),
    () => fallback,
  );
  const set = useCallback(
    (next: T | null | ((prev: T) => T | null)) => {
      const resolved = typeof next === "function" ? (next as (p: T) => T | null)(getValue(key, fallback)) : next;
      setValue(key, resolved);
    },
    [key, fallback],
  );
  return [value, set] as const;
}

const noopSubscribe = () => () => {};

/** False while the page is rendering on the server or hydrating, true afterwards. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
