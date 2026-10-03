"use client";

import { useRef } from "react";
import type { EditorField, EditorStaticText, TemplateTableRegion, Selection } from "./types";
import { snapToGrid, clampPercent } from "./utils";

interface EditorCanvasProps {
  backgroundImageUrl: string;
  fields: EditorField[];
  staticTexts: EditorStaticText[];
  tableRegions: TemplateTableRegion[];
  selection: Selection | null;
  onSelect: (sel: Selection | null) => void;
  onFieldDrag: (index: number, xPercent: number, yPercent: number) => void;
  onStaticDrag: (index: number, xPercent: number, yPercent: number) => void;
  onRegionDrag: (index: number, xPercent: number, yPercent: number) => void;
  onFieldResize: (
    index: number,
    widthPercent: number,
    heightPercent: number,
    xPercent: number,
    yPercent: number,
  ) => void;
  onDragEnd: () => void;
}

type DragState =
  | { kind: "none" }
  | { kind: "field"; index: number; startX: number; startY: number; fieldX: number; fieldY: number }
  | { kind: "static"; index: number; startX: number; startY: number; textX: number; textY: number }
  | { kind: "region"; index: number; startX: number; startY: number; anchorX: number; anchorY: number }
  | { kind: "resize"; index: number; startX: number; startY: number; handle: string; fieldX: number; fieldY: number; fieldW: number; fieldH: number };

let dragState: DragState = { kind: "none" };

export function EditorCanvas({
  backgroundImageUrl,
  fields,
  staticTexts,
  tableRegions,
  selection,
  onSelect,
  onFieldDrag,
  onStaticDrag,
  onRegionDrag,
  onFieldResize,
  onDragEnd,
}: EditorCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);

  function pxToPercent(dxPx: number, dyPx: number) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      dx: (dxPx / rect.width) * 100,
      dy: (dyPx / rect.height) * 100,
    };
  }

  function screenToCanvas(clientX: number, clientY: number) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: clampPercent(((clientX - rect.left) / rect.width) * 100),
      y: clampPercent(((clientY - rect.top) / rect.height) * 100),
    };
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (dragState.kind === "none") return;
    e.preventDefault();

    if (dragState.kind === "field") {
      const { dx, dy } = pxToPercent(e.clientX - dragState.startX, e.clientY - dragState.startY);
      onFieldDrag(
        dragState.index,
        snapToGrid(clampPercent(dragState.fieldX + dx)),
        snapToGrid(clampPercent(dragState.fieldY + dy)),
      );
    } else if (dragState.kind === "static") {
      const { dx, dy } = pxToPercent(e.clientX - dragState.startX, e.clientY - dragState.startY);
      onStaticDrag(
        dragState.index,
        snapToGrid(clampPercent(dragState.textX + dx)),
        snapToGrid(clampPercent(dragState.textY + dy)),
      );
    } else if (dragState.kind === "region") {
      const { dx, dy } = pxToPercent(e.clientX - dragState.startX, e.clientY - dragState.startY);
      onRegionDrag(
        dragState.index,
        snapToGrid(clampPercent(dragState.anchorX + dx)),
        snapToGrid(clampPercent(dragState.anchorY + dy)),
      );
    } else if (dragState.kind === "resize") {
      const { dx, dy } = pxToPercent(e.clientX - dragState.startX, e.clientY - dragState.startY);
      const handle = dragState.handle;
      let newW = dragState.fieldW;
      let newH = dragState.fieldH;
      let newX = dragState.fieldX;
      let newY = dragState.fieldY;

      if (handle.includes("right")) newW = Math.max(2, snapToGrid(dragState.fieldW + dx));
      if (handle.includes("left")) { newW = Math.max(2, snapToGrid(dragState.fieldW - dx)); newX = snapToGrid(dragState.fieldX + dx); }
      if (handle.includes("bottom")) newH = Math.max(1, snapToGrid(dragState.fieldH + dy));
      if (handle.includes("top")) { newH = Math.max(1, snapToGrid(dragState.fieldH - dy)); newY = snapToGrid(dragState.fieldY + dy); }

      onFieldResize(dragState.index, newW, newH, newX, newY);
    }
  }

  function handlePointerUp() {
    if (dragState.kind !== "none") {
      dragState = { kind: "none" };
      onDragEnd();
    }
  }

  const selectedField = selection?.type === "FIELD" ? fields[selection.index] : null;
  const selectedStatic = selection?.type === "STATIC_TEXT" ? staticTexts[selection.index] : null;

  return (
    <div className="flex-1 overflow-auto bg-surface p-4 sm:p-8">
      <div
        ref={canvasRef}
        className="relative mx-auto w-full max-w-[700px] border border-border bg-bg shadow-sm"
        style={{ aspectRatio: "210/297" }}
        onClick={(e) => {
          if (e.target === canvasRef.current) onSelect(null);
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* Background image */}
        <img
          src={backgroundImageUrl}
          alt="Template background"
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          draggable={false}
        />

        {/* Fields */}
        {fields.map((field, i) => {
          const isSelected = selection?.type === "FIELD" && selection.index === i;
          const hasSize = field.widthPercent != null && field.heightPercent != null;
          return (
            <div
              key={`f-${i}`}
              className="absolute select-none"
              style={{
                left: `${field.xPercent}%`,
                top: `${field.yPercent}%`,
                transform: "translate(-50%, -50%)",
                ...(hasSize ? { width: `${field.widthPercent}%`, height: `${field.heightPercent}%` } : {}),
                zIndex: isSelected ? 20 : 10,
                cursor: "grab",
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onSelect({ type: "FIELD", index: i });
                dragState = {
                  kind: "field",
                  index: i,
                  startX: e.clientX,
                  startY: e.clientY,
                  fieldX: field.xPercent,
                  fieldY: field.yPercent,
                };
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
              }}
            >
              <div
                className={`h-full w-full border px-1 py-0.5 text-[10px] font-mono whitespace-nowrap overflow-hidden ${
                  isSelected
                    ? "border-primary bg-primary/15 ring-1 ring-primary text-primary"
                    : "border-primary/60 bg-primary/8 text-primary/80"
                }`}
                style={{
                  fontSize: hasSize ? undefined : `${Math.min(field.fontSize, 14)}px`,
                  fontFamily: field.fontFamily || "monospace",
                  fontWeight: field.fontWeight || undefined,
                  fontStyle: field.fontStyle || undefined,
                  textAlign: field.textAlign,
                }}
              >
                {field.fieldKey}
              </div>

              {/* Resize handles — only on selected */}
              {isSelected && hasSize && (
                <>
                  {(["top-left", "top-right", "bottom-left", "bottom-right"] as const).map((handle) => (
                    <div
                      key={handle}
                      className="absolute z-30"
                      style={{
                        width: 8, height: 8,
                        background: "#2563eb",
                        border: "1px solid white",
                        ...(handle.includes("top") ? { top: -4 } : { bottom: -4 }),
                        ...(handle.includes("left") ? { left: -4 } : { right: -4 }),
                        cursor: handle === "top-left" || handle === "bottom-right" ? "nwse-resize" : "nesw-resize",
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        dragState = {
                          kind: "resize",
                          index: i,
                          startX: e.clientX,
                          startY: e.clientY,
                          handle,
                          fieldX: field.xPercent,
                          fieldY: field.yPercent,
                          fieldW: field.widthPercent ?? 10,
                          fieldH: field.heightPercent ?? 3,
                        };
                        (e.target as HTMLElement).setPointerCapture(e.pointerId);
                      }}
                    />
                  ))}
                </>
              )}
            </div>
          );
        })}

        {/* Static texts */}
        {staticTexts.map((st, i) => {
          const isSelected = selection?.type === "STATIC_TEXT" && selection.index === i;
          const hasSize = st.widthPercent != null && st.heightPercent != null;
          return (
            <div
              key={`st-${i}`}
              className="absolute select-none"
              style={{
                left: `${st.xPercent}%`,
                top: `${st.yPercent}%`,
                transform: "translate(-50%, -50%)",
                ...(hasSize ? { width: `${st.widthPercent}%`, height: `${st.heightPercent}%` } : {}),
                zIndex: isSelected ? 20 : 10,
                cursor: "grab",
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onSelect({ type: "STATIC_TEXT", index: i });
                dragState = {
                  kind: "static",
                  index: i,
                  startX: e.clientX,
                  startY: e.clientY,
                  textX: st.xPercent,
                  textY: st.yPercent,
                };
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
              }}
            >
              <div
                className={`h-full w-full border px-1 py-0.5 text-[10px] whitespace-nowrap overflow-hidden ${
                  isSelected
                    ? "border-success bg-success/15 ring-1 ring-success text-success"
                    : "border-success/60 bg-success/8 text-success/80"
                }`}
                style={{
                  fontSize: hasSize ? undefined : `${Math.min(st.fontSize, 14)}px`,
                  fontFamily: st.fontFamily || "serif",
                  fontWeight: st.fontWeight || undefined,
                  fontStyle: st.fontStyle || undefined,
                  textAlign: st.textAlign,
                }}
              >
                {st.content}
              </div>
            </div>
          );
        })}

        {/* Table regions */}
        {tableRegions.map((region, i) => (
          <div
            key={`tr-${i}`}
            className={`absolute cursor-move border border-dashed ${
              selection?.type === "TABLE_REGION" && selection.index === i
                ? "border-orange-400 bg-orange-50/40"
                : "border-text/40 bg-surface/40"
            }`}
            style={{
              left: `${region.anchorXPercent}%`,
              top: `${region.anchorYPercent}%`,
              width: "60%",
              height: `${region.rowHeightPercent * 3}%`,
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onSelect({ type: "TABLE_REGION", index: i });
              dragState = {
                kind: "region",
                index: i,
                startX: e.clientX,
                startY: e.clientY,
                anchorX: region.anchorXPercent,
                anchorY: region.anchorYPercent,
              };
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
            }}
          >
            <span className="absolute -top-4 left-0 text-[9px] font-medium text-text/70">
              Table {i + 1}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
