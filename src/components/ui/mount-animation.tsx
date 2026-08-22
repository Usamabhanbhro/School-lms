"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

/**
 * Wraps children with a subtle fade-in + slide-up animation on mount.
 * Used for the sign-in → dashboard transition to avoid a jarring hard cut.
 *
 * Timing follows DESIGN.md: 200ms ease-out (same family as other opens).
 * Respects prefers-reduced-motion via the global CSS rule that sets
 * animation-duration to 0.01ms when reduced motion is preferred.
 */
export function MountAnimation({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Small delay to ensure the browser has painted the initial state
    // before triggering the animation.
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="transition-none"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 200ms ease-out, transform 200ms ease-out",
      }}
    >
      {children}
    </div>
  );
}
