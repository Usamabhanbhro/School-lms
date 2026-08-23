"use client";

import { useEffect, useRef } from "react";
import { signOut } from "next-auth/react";

/**
 * Session idle timeout.
 *
 * After `IDLE_TIMEOUT_MS` of inactivity (no clicks, keystrokes, touches,
 * scroll, or pointer movement) the session is cleared via NextAuth signOut
 * and the user is redirected to /login?expired=1, where the login form shows
 * a clear "Session expired due to inactivity" message instead of a silent
 * redirect. Mounted in the shared dashboard layout, so it applies to Admin,
 * Academics, and Teacher alike.
 *
 * For testing purposes the timeout can be lowered by temporarily changing
 * IDLE_TIMEOUT_MS — restore it to 15 minutes afterwards (see ROADMAP Phase 9).
 */
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "keydown",
  "pointerdown",
  "touchstart",
  "wheel",
  "scroll",
  "pageshow",
  "focus",
];

export function SessionIdleTimeout() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signedOutRef = useRef(false);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const resetTimer = () => {
      clearTimer();
      timerRef.current = setTimeout(async () => {
        if (signedOutRef.current) return;
        // Guard: only fire once — signOut navigates away anyway.
        signedOutRef.current = true;
        // Clears the JWT session cookie and redirects with a reason.
        await signOut({
          callbackUrl: "/login?expired=1",
          redirect: true,
        });
      }, IDLE_TIMEOUT_MS);
    };

    // Any user activity resets the countdown.
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetTimer, { passive: true });
    }

    // Navigation within the SPA is activity too.
    const handleVisibility = () => {
      if (document.visibilityState === "visible") resetTimer();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    resetTimer();

    return () => {
      clearTimer();
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetTimer);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // This component renders nothing — it only manages the timer.
  return null;
}