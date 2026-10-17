"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { Profile } from "./types";
import { DEFAULT_EXAMPLE } from "./examples";

// No logins: the current user's profile lives in this browser's localStorage.
const KEY = "byob-profile";

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}

const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
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
