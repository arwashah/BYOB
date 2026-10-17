"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { Profile } from "./types";
import { DEFAULT_EXAMPLE } from "./examples";

// No logins: the current user's profile lives in this browser's localStorage.
const KEY = "byob-profile";
// Onboarding in progress, so a refresh or a later visit picks up where they left off.
const DRAFT_KEY = "byob-draft";

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
  emit();
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
