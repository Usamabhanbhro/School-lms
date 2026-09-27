export type ElementType = "FIELD" | "STATIC_TEXT" | "TABLE_REGION";

export interface Selection {
  type: ElementType;
  index: number;
}

export type TextAlign = "left" | "center" | "right";

export interface EditorField {
  fieldKey: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number | null;
  heightPercent: number | null;
  fontSize: number;
  fontFamily: string;
  fontColor: string;
  fontWeight: string;
  fontStyle: string;
  textDecoration: string;
  textAlign: TextAlign;
}

export interface EditorStaticText {
  content: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number | null;
  heightPercent: number | null;
  fontSize: number;
  fontFamily: string;
  fontColor: string;
  fontWeight: string;
  fontStyle: string;
  textDecoration: string;
  textAlign: TextAlign;
}

export interface TemplateTableRegion {
  anchorXPercent: number;
  anchorYPercent: number;
  rowHeightPercent: number;
  columns: Array<{ fieldKey: string; xPercent: number; label: string }>;
}

export interface EditorSnapshot {
  fields: EditorField[];
  staticTexts: EditorStaticText[];
  tableRegions: TemplateTableRegion[];
}
