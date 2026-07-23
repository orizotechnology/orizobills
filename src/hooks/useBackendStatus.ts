import { useState, useEffect, useRef, useCallback } from "react";
import { APP_CONFIG } from "@/config/app.config";

// =============================================================
// useBackendStatus
// Polls the configured API health endpoint directly.
// Works in both Tauri WebView and browser (CORS allows localhost).
// =============================================================

export type BackendStatus = "checking" | "online" | "offline";

// Give the backend up to ~90 seconds to start (DB init + Prisma push can be slow).
// Once connected it keeps polling every 3s. If it drops it retries forever.
const MAX_ATTEMPTS  = 90;   // 90 × 1s = 90s initial window
const INITIAL_DELAY = 800;
const NORMAL_DELAY  = 3000;
const OFFLINE_DELAY = 4000;
const HEALTH_URLS   = [
  `${APP_CONFIG.apiBaseUrl}/api/health`,
  "http://127.0.0.1:5000/api/health",
];

export function useBackendStatus(): BackendStatus {
  const [status, setStatus] = useState<BackendStatus>("checking");
  const attempts = useRef(0);

  const check = useCallback(
    async (cancelled: { value: boolean }, setTimer: (t: ReturnType<typeof setTimeout>) => void) => {
      if (cancelled.value) return;
      try {
        for (const healthUrl of HEALTH_URLS) {
          const controller = new AbortController();
          const timeoutId = window.setTimeout(() => controller.abort(), 4000);

          try {
            const res = await fetch(healthUrl, {
              cache: "no-store",
              mode: "cors",
              signal: controller.signal,
            });
            if (!cancelled.value && res.ok) { setStatus("online"); attempts.current = 0; return; }
          } catch {
            // keep trying the next fallback URL
          } finally {
            window.clearTimeout(timeoutId);
          }
        }
      } catch { /* keep retrying */ }

      if (cancelled.value) return;
      attempts.current++;

      // After MAX_ATTEMPTS set status to offline so the UI shows the banner,
      // but keep retrying — if the backend comes up later, flip back online.
      if (attempts.current >= MAX_ATTEMPTS) {
        setStatus("offline");
      }
      const delay = attempts.current < 5 ? INITIAL_DELAY
                  : attempts.current < MAX_ATTEMPTS ? NORMAL_DELAY
                  : OFFLINE_DELAY;
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
