"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { Profile } from "./types";
import { DEFAULT_EXAMPLE } from "./examples";

// The current user's profile lives in this browser's localStorage. When they're
// logged in, lib/cloud.ts mirrors it to their Supabase row.
const KEY = "byob-profile";
// Onboarding in progress, so a refresh or a later visit picks up where they left off.
const DRAFT_KEY = "byob-draft";
// Answers worth keeping (e.g. the gap scan), so a returning user doesn't wait again.
const RESULTS_KEY = "byob-results";
const AUTOSAVE_PREFIX = "byob-autosave:";
// When this browser's BYOB data last changed, so a newer local edit never loses to an older cloud copy.
const UPDATED_KEY = "byob-updated-at";
let restoring = false;

export interface Draft {
  step: number;
  description: string;
  profile: Profile | null;
  roughMonthly: string;
}

// The "storage" event only fires in other tabs, so same-tab changes notify here.
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
  if (!restoring) touchLocal();
  emit();
}

export function touchLocal() {
  try {
    localStorage.setItem(UPDATED_KEY, new Date().toISOString());
  } catch {}
}

export function localUpdatedAt(): number {
  try {
    return Date.parse(localStorage.getItem(UPDATED_KEY) ?? "") || 0;
  } catch {
    return 0;
  }
}

export function saveProfile(p: Profile) {
  write(KEY, JSON.stringify(p));
  write(DRAFT_KEY, null);
}

export function saveDraft(d: Draft) {
  write(DRAFT_KEY, JSON.stringify(d));
}

export function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export function startOver() {
  write(KEY, null);
  write(DRAFT_KEY, null);
}

const readJson = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export function readResult<T>(name: string): T | null {
  return (readJson<Record<string, T>>(RESULTS_KEY) ?? {})[name] ?? null;
}

export function saveResult(name: string, value: unknown) {
  write(RESULTS_KEY, JSON.stringify({ ...(readJson<Record<string, unknown>>(RESULTS_KEY) ?? {}), [name]: value }));
}

// Same-tab change notifications, for the cloud sync.
export function onLocalChange(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export interface LocalSnapshot {
  profile: Profile | null;
  results: Record<string, unknown>; // includes draft and autoSave so the whole state round-trips
}

const autoSaveKeys = () => {
  try {
    return Object.keys(localStorage).filter((k) => k.startsWith(AUTOSAVE_PREFIX));
  } catch {
    return [];
  }
};

export function localSnapshot(): LocalSnapshot {
  return {
    profile: readJson<Profile>(KEY),
    results: {
      ...(readJson<Record<string, unknown>>(RESULTS_KEY) ?? {}),
      draft: readJson<Draft>(DRAFT_KEY),
      autoSave: autoSaveKeys().map((k) => k.slice(AUTOSAVE_PREFIX.length)),
    },
  };
}

// Replace this browser's copy with the cloud's. `updatedAt` is the cloud row's time.
export function restoreLocal(s: LocalSnapshot, updatedAt?: string) {
  const { draft, autoSave, ...results } = s.results as { draft?: Draft | null; autoSave?: string[] } & Record<string, unknown>;
  restoring = true;
  try {
    clearLocal();
    try {
      for (const name of autoSave ?? []) localStorage.setItem(AUTOSAVE_PREFIX + name, "on");
      if (updatedAt) localStorage.setItem(UPDATED_KEY, updatedAt);
    } catch {}
    write(RESULTS_KEY, JSON.stringify(results));
    write(DRAFT_KEY, draft ? JSON.stringify(draft) : null);
    write(KEY, s.profile && Object.keys(s.profile).length ? JSON.stringify(s.profile) : null);
  } finally {
    restoring = false;
  }
  window.dispatchEvent(new Event("byob-autosave"));
}

// Everything BYOB keeps in this browser (used on log out, so the next person starts fresh).
export function clearLocal() {
  const was = restoring;
  restoring = true;
  try {
    try {
      for (const k of autoSaveKeys()) localStorage.removeItem(k);
      localStorage.removeItem(UPDATED_KEY);
    } catch {}
    write(RESULTS_KEY, null);
    write(DRAFT_KEY, null);
    write(KEY, null);
  } finally {
    restoring = was;
  }
  window.dispatchEvent(new Event("byob-autosave"));
}

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
};

const readRaw = () => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};

// Returns null while prerendering (avoids a hydration mismatch), then the saved
// profile, or Maya if someone opens a later page directly.
export function useProfile(): Profile | null {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  return useMemo(() => {
    if (raw === null) return null;
    try {
      return raw ? (JSON.parse(raw) as Profile) : DEFAULT_EXAMPLE;
    } catch {
      return DEFAULT_EXAMPLE;
    }
  }, [raw]);
}

// The profile the user actually finished onboarding with (no Maya fallback),
// or null if there isn't one yet. Undefined while prerendering.
export function useSavedProfile(): Profile | null | undefined {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  return useMemo(() => {
    if (raw === null) return undefined;
    try {
      return raw ? (JSON.parse(raw) as Profile) : null;
    } catch {
      return null;
    }
  }, [raw]);
}
