"use client";

import type { ReactNode } from "react";

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

export function Collapsible({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: open ? "1fr" : "0fr",
        opacity: open ? 1 : 0,
        transition:
          `grid-template-rows 200ms ${EASE_OUT}, opacity 200ms ${EASE_OUT}`,
      }}
    >
      <div style={{ overflow: "hidden" }}>{children}</div>
    </div>
  );
}
