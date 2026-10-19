import {
  type DeckColor,
  type DeckContent,
  type FreeElement,
  SLIDE_SLOT_IDS,
  type Slide,
  type SlideFrame,
  type SlideLayoutId,
  type SlideSlotId,
  type SlotContent,
  type TableData,
  type TextParagraph,
  type TextRole,
} from "@cocurdex/shared";
import { SLIDE_LAYOUTS, type SlotSpec } from "./layouts";
import { fitTable, fitText } from "./text-fit";
import { type DeckTheme, deckTheme, type RoleTypography } from "./theme";

export type ResolvedSource =
  | { kind: "slot"; slot: SlideSlotId }
  | { kind: "element"; elementId: string }
  | { kind: "decoration"; index: number };

export interface ResolvedText {
  kind: "text";
  source: ResolvedSource;
  frame: SlideFrame;
  paragraphs: TextParagraph[];
  role: TextRole;
  fontSize: number;
  color: DeckColor;
  bold: boolean;
  align: "left" | "center";
  valign: "top" | "middle" | "bottom";
  lineHeight: number;
  overflow: boolean;
}

export interface ResolvedTable {
  kind: "table";
  source: ResolvedSource;
  frame: SlideFrame;
  table: TableData;
  fontSize: number;
  lineHeight: number;
  overflow: boolean;
}

export interface ResolvedShape {
  kind: "shape";
  source: ResolvedSource;
  frame: SlideFrame;
  shape: "rect" | "ellipse";
  fill: DeckColor;
}

export type ResolvedItem = ResolvedText | ResolvedTable | ResolvedShape;

export interface ResolvedSlide {
  id: string;
  layout: SlideLayoutId;
  background: DeckColor;
  items: ResolvedItem[];
  notes: string;
}

const TABLE_FONT = { max: 22, min: 10 };
const TABLE_LINE_HEIGHT = 1.25;

function typographyFor(
  theme: DeckTheme,
  spec: Pick<SlotSpec, "role" | "typography">,
): RoleTypography {
  return { ...theme.roles[spec.role], ...spec.typography };
}

function resolveText(
  source: ResolvedSource,
  frame: SlideFrame,
  paragraphs: TextParagraph[],
  spec: Omit<SlotSpec, "frame">,
  theme: DeckTheme,
): ResolvedText {
  const typography = typographyFor(theme, spec);
  const fit = fitText(
    paragraphs,
    frame,
    { max: typography.maxSize, min: typography.minSize },
    typography.lineHeight,
  );
  return {
    kind: "text",
    source,
    frame,
    paragraphs,
    role: spec.role,
    fontSize: fit.fontSize,
    color: spec.color,
    bold: typography.bold,
    align: spec.align,
    valign: spec.valign,
    lineHeight: typography.lineHeight,
    overflow: fit.overflow,
  };
}

function resolveTable(
  source: ResolvedSource,
  frame: SlideFrame,
  table: TableData,
): ResolvedTable {
  const fit = fitTable(table, frame, TABLE_FONT, TABLE_LINE_HEIGHT);
  return {
    kind: "table",
    source,
    frame,
    table,
    fontSize: fit.fontSize,
    lineHeight: TABLE_LINE_HEIGHT,
    overflow: fit.overflow,
  };
}

function resolveSlot(
  slot: SlideSlotId,
  content: SlotContent,
  spec: SlotSpec,
  frame: SlideFrame,
  theme: DeckTheme,
): ResolvedItem {
  const source: ResolvedSource = { kind: "slot", slot };
  if (content.kind === "table") {
    return resolveTable(source, frame, content.table);
  }
  return resolveText(source, frame, content.paragraphs, spec, theme);
}

const FREE_TEXT_SPEC: Record<TextRole, Omit<SlotSpec, "frame">> = {
  title: { role: "title", color: "text", align: "left", valign: "top" },
  subtitle: { role: "subtitle", color: "muted", align: "left", valign: "top" },
  body: { role: "body", color: "text", align: "left", valign: "top" },
  caption: { role: "caption", color: "muted", align: "left", valign: "top" },
};

function resolveElement(element: FreeElement, theme: DeckTheme): ResolvedItem {
  const source: ResolvedSource = { kind: "element", elementId: element.id };
  switch (element.kind) {
    case "text":
      return resolveText(
        source,
        element.frame,
        element.paragraphs,
        FREE_TEXT_SPEC[element.role],
        theme,
      );
    case "table":
      return resolveTable(source, element.frame, element.table);
    case "shape":
      return {
        kind: "shape",
        source,
        frame: element.frame,
        shape: element.shape,
        fill: element.fill,
      };
  }
}

export function slotSpecsFor(layout: SlideLayoutId) {
  return SLIDE_LAYOUTS[layout].slots;
}

export function resolveEmptySlots(
  slide: Slide,
  deck: DeckContent,
): ResolvedText[] {
  const theme = deckTheme(deck.theme);
  const layout = SLIDE_LAYOUTS[slide.layout];
  return SLIDE_SLOT_IDS.flatMap((slot) => {
    const spec = layout.slots[slot];
    if (slide.slots[slot] || !spec) return [];
    const frame = slide.slotFrames?.[slot] ?? spec.frame;
    return [resolveText({ kind: "slot", slot }, frame, [], spec, theme)];
  });
}

export function resolveSlide(slide: Slide, deck: DeckContent): ResolvedSlide {
  const theme = deckTheme(deck.theme);
  const layout = SLIDE_LAYOUTS[slide.layout];
  const items: ResolvedItem[] = layout.decorations.map((decoration, index) => ({
    kind: "shape",
    source: { kind: "decoration", index },
    frame: decoration.frame,
    shape: decoration.shape,
    fill: decoration.fill,
  }));
  for (const slot of SLIDE_SLOT_IDS) {
    const content = slide.slots[slot];
    const spec = layout.slots[slot];
    if (!content || !spec) continue;
    const frame = slide.slotFrames?.[slot] ?? spec.frame;
    items.push(resolveSlot(slot, content, spec, frame, theme));
  }
  for (const element of slide.elements) {
    items.push(resolveElement(element, theme));
  }
  return {
    id: slide.id,
    layout: slide.layout,
    background: layout.background,
    items,
    notes: slide.notes,
  };
}
