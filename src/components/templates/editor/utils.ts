import type { EditorField, EditorStaticText } from "./types";

export const DEFAULT_FIELD: Omit<EditorField, "fieldKey"> = {
  xPercent: 50,
  yPercent: 50,
  widthPercent: null,
  heightPercent: null,
  fontSize: 12,
  fontFamily: "",
  fontColor: "",
  fontWeight: "",
  fontStyle: "",
  textDecoration: "",
  textAlign: "left",
};

export const DEFAULT_STATIC_TEXT: Omit<EditorStaticText, "content"> = {
  xPercent: 50,
  yPercent: 50,
  widthPercent: null,
  heightPercent: null,
  fontSize: 14,
  fontFamily: "",
  fontColor: "",
  fontWeight: "",
  fontStyle: "",
  textDecoration: "",
  textAlign: "left",
};

export const SNAP_GRID = 0.5;

export function snapToGrid(val: number, snap = SNAP_GRID) {
  return Math.round(val / snap) * snap;
}

export function clampPercent(val: number) {
  return Math.min(100, Math.max(0, val));
}
