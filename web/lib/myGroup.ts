"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { Profile } from "./types";
import { onLocalChange, readResult, saveResult } from "./useProfile";

// The user's own group: just them for now. Saved with their results, so it
// follows them to other devices when they're logged in.
export interface MyGroup {
  name: string;
  createdAt: string; // the waiting period starts here
}

const subscribe = (cb: () => void) => {
  const off = onLocalChange(cb);
  window.addEventListener("storage", cb);
  return () => {
    off();
    window.removeEventListener("storage", cb);
  };
};
const snapshot = () => JSON.stringify(readResult<MyGroup>("group"));

export function useMyGroup(): MyGroup | null {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "null");
  return useMemo(() => JSON.parse(raw) as MyGroup | null, [raw]);
}

export function createGroup(profile: Profile) {
  const name = profile.name && profile.name !== "You" ? `${profile.name}'s group` : "My group";
  saveResult("group", { name, createdAt: new Date().toISOString() } satisfies MyGroup);
}

export function leaveGroup() {
  saveResult("group", null);
}
