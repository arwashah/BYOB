"use client";

// Login + sync. The screens keep reading this browser's localStorage (lib/useProfile.ts);
// while someone is logged in, every change is mirrored to their row in public.profiles,
// and on login their row is loaded back. Policy PDFs are never stored.

import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { clearLocal, localSnapshot, localUpdatedAt, onLocalChange, restoreLocal } from "./useProfile";

export interface AuthState {
  enabled: boolean; // false when Supabase keys aren't set (guest-only)
  ready: boolean; // false while we check the session or load the user's row
  user: User | null;
}

const SERVER: AuthState = { enabled: !!supabase, ready: false, user: null };
let state: AuthState = { enabled: !!supabase, ready: !supabase, user: null };
const subs = new Set<() => void>();
const set = (s: AuthState) => {
  state = s;
  subs.forEach((f) => f());
};

let started = false;
let syncedFor: string | null = null; // only push once this user's row has been loaded
let pushTimer: ReturnType<typeof setTimeout> | undefined;

// Which account this browser's BYOB data belongs to (unset for guests).
const OWNER_KEY = "byob-owner";
const owner = () => {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
};
const setOwner = (id: string | null) => {
  try {
    if (id) localStorage.setItem(OWNER_KEY, id);
    else localStorage.removeItem(OWNER_KEY);
  } catch {}
};

let pending = false;

async function push(userId: string) {
  if (!supabase) return;
  pending = false;
  const snap = localSnapshot();
  const { error } = await supabase.from("profiles").upsert({
    user_id: userId,
    profile: snap.profile ?? {},
    results: snap.results,
    updated_at: new Date(localUpdatedAt() || Date.now()).toISOString(),
  });
  if (error) console.warn("Couldn't save to your account:", error.message);
}

function schedulePush() {
  if (!syncedFor) return;
  const id = syncedFor;
  pending = true;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => push(id), 400);
}

// Leaving or reloading the page: send any change that's still waiting.
function flush() {
  if (pending && syncedFor) {
    clearTimeout(pushTimer);
    push(syncedFor);
  }
}

async function pull(user: User) {
  if (!supabase) return;
  const { data, error } = await supabase
    .from("profiles")
    .select("profile, results, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.warn("Couldn't load your account:", error.message);
    return;
  }
  const local = localSnapshot();
  const hasLocal = !!(local.profile || local.results.draft);
  const hasCloud = !!data && (Object.keys(data.profile ?? {}).length > 0 || !!(data.results as { draft?: unknown })?.draft);
  const cloudAt = data?.updated_at ? Date.parse(data.updated_at) : 0;

  if (hasLocal && owner() === user.id && localUpdatedAt() > cloudAt) {
    await push(user.id); // this device has newer changes (e.g. a reload before the last save went out)
  } else if (hasCloud) {
    restoreLocal({ profile: data!.profile, results: data!.results ?? {} }, data!.updated_at);
  } else if (hasLocal) {
    await push(user.id); // guest work moves into the new account
  }
  setOwner(user.id);
}

let loadingFor: string | null = null;

async function handle(user: User | null) {
  if (user?.id === state.user?.id && state.ready) return;
  if (!user) {
    syncedFor = null;
    loadingFor = null;
    set({ enabled: true, ready: true, user: null });
    return;
  }
  if (loadingFor === user.id) return; // already loading this user's row
  loadingFor = user.id;
  set({ enabled: true, ready: false, user });
  await pull(user);
  if (loadingFor !== user.id) return; // logged out while loading
  loadingFor = null;
  syncedFor = user.id;
  set({ enabled: true, ready: true, user });
}

function start() {
  if (started || !supabase || typeof window === "undefined") return;
  started = true;
  supabase.auth.getSession().then(({ data }) => handle(data.session?.user ?? null));
  // Supabase asks not to await its own calls inside this callback, so hop out first.
  supabase.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => handle(session?.user ?? null), 0);
  });
  onLocalChange(schedulePush);
  window.addEventListener("byob-autosave", schedulePush);
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

const subscribe = (cb: () => void) => {
  start();
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
};

export const useAuth = () => useSyncExternalStore(subscribe, () => state, () => SERVER);

// ---- "Try as guest": remembered on this device so the login page doesn't keep coming back ----

const GUEST_KEY = "byob-guest";
const GUEST_EVENT = "byob-guest";
const readGuest = () => {
  try {
    return localStorage.getItem(GUEST_KEY) === "on";
  } catch {
    return false;
  }
};
const subscribeGuest = (cb: () => void) => {
  window.addEventListener(GUEST_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(GUEST_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};
export const useGuest = () => useSyncExternalStore(subscribeGuest, readGuest, () => false);

export function setGuest(on: boolean) {
  try {
    if (on) localStorage.setItem(GUEST_KEY, "on");
    else localStorage.removeItem(GUEST_KEY);
  } catch {}
  window.dispatchEvent(new Event(GUEST_EVENT));
}

// ---- actions (each returns an error message, or null) ----

const back = () => `${window.location.origin}/login`;
const msg = (e: { message: string } | null) => e?.message ?? null;

export async function logInWithPassword(email: string, password: string) {
  if (!supabase) return "Login isn't set up yet.";
  return msg((await supabase.auth.signInWithPassword({ email, password })).error);
}

// Returns "confirm" when Supabase wants the user to confirm their email first.
export async function signUp(email: string, password: string): Promise<string | null> {
  if (!supabase) return "Login isn't set up yet.";
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: back() } });
  if (error) return error.message;
  return data.session ? null : "confirm";
}

export async function emailLoginLink(email: string) {
  if (!supabase) return "Login isn't set up yet.";
  return msg((await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: back() } })).error);
}

export async function continueWithGoogle() {
  if (!supabase) return "Login isn't set up yet.";
  return msg((await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: back() } })).error);
}

export async function logOut() {
  if (!supabase) return;
  clearTimeout(pushTimer);
  if (syncedFor) await push(syncedFor); // save the latest changes first
  syncedFor = null;
  await supabase.auth.signOut();
  clearLocal(); // shared device: the next person shouldn't see this user's data
  setOwner(null);
  setGuest(false); // the next visit starts at the login page again
}
