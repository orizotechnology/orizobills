import { useState, useEffect, useRef, useCallback } from "react";

// =============================================================
// useBackendStatus
// Polls http://localhost:5000/api/health directly.
// Works in both Tauri WebView and browser (CORS allows localhost).
// =============================================================

export type BackendStatus = "checking" | "online" | "offline";

const MAX_ATTEMPTS  = 40;
const INITIAL_DELAY = 500;
const NORMAL_DELAY  = 1500;
const OFFLINE_DELAY = 3000;
const HEALTH_URL    = "http://localhost:5000/api/health";

export function useBackendStatus(): BackendStatus {
  const [status, setStatus] = useState<BackendStatus>("checking");
  const attempts = useRef(0);

  const check = useCallback(
    async (cancelled: { value: boolean }, setTimer: (t: ReturnType<typeof setTimeout>) => void) => {
      if (cancelled.value) return;
      try {
        const res = await fetch(HEALTH_URL, {
          cache: "no-store",
          mode: "cors",
          signal: AbortSignal.timeout(4000),
        });
        if (!cancelled.value && res.ok) { setStatus("online"); return; }
      } catch { /* keep retrying */ }

      if (cancelled.value) return;
      attempts.current++;

      let delay: number;
      if (attempts.current >= MAX_ATTEMPTS) {
        setStatus("offline");
        delay = OFFLINE_DELAY;
      } else {
        delay = attempts.current < 5 ? INITIAL_DELAY : NORMAL_DELAY;
      }
      setTimer(setTimeout(() => check(cancelled, setTimer), delay));
    },
    []
  );

  useEffect(() => {
    const cancelled = { value: false };
    let timer: ReturnType<typeof setTimeout>;
    check(cancelled, (t) => { timer = t; });
    return () => { cancelled.value = true; clearTimeout(timer); };
  }, [check]);

  return status;
}
