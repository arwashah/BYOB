"use client";

import { useEffect, useState } from "react";

// Keeps a server answer in sync with fast-changing inputs (sliders, steppers)
// without making the input wait: the input updates instantly, the request goes
// out after a short pause, older requests are cancelled, and the previous
// answer stays on screen until the new one arrives (no loading flash).
export function useLive<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
  delay = 150,
  enabled = true,
): T | null {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetcher(ctrl.signal).then(setValue).catch(() => {});
    }, delay);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);
  return value;
}
