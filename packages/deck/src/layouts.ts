import type {
  DeckColor,
  SlideFrame,
  SlideLayoutId,
  SlideSlotId,
  TextRole,
} from "@cocurdex/shared";
import type { RoleTypography } from "./theme";

export interface SlotSpec {
  frame: SlideFrame;
  role: TextRole;
  color: DeckColor;
  align: "left" | "center";
  valign: "top" | "middle" | "bottom";
  typography?: Partial<RoleTypography>;
}

export interface DecorationSpec {
  frame: SlideFrame;
  shape: "rect";
  fill: DeckColor;
}

export interface LayoutSpec {
  background: DeckColor;
  slots: Partial<Record<SlideSlotId, SlotSpec>>;
  decorations: DecorationSpec[];
}

const MARGIN_X = 80;
const CONTENT_WIDTH = 1120;
const BODY_TOP = 176;
const BODY_HEIGHT = 480;
const COLUMN_WIDTH = 528;

const TITLE: SlotSpec = {
  frame: { x: MARGIN_X, y: 48, w: CONTENT_WIDTH, h: 104 },
  role: "title",
  color: "text",
  align: "left",
  valign: "bottom",
};

const BODY: SlotSpec = {
  frame: { x: MARGIN_X, y: BODY_TOP, w: CONTENT_WIDTH, h: BODY_HEIGHT },
  role: "body",
  color: "text",
  align: "left",
  valign: "top",
};

function titleSlide(align: "left" | "center"): LayoutSpec {
  return {
    background: "accent",
    decorations: [],
    slots: {
      title: {
        frame: { x: MARGIN_X, y: 160, w: CONTENT_WIDTH, h: 240 },
        role: "title",
        color: "onAccent",
        align,
        valign: "bottom",
        typography: { maxSize: 64, minSize: 36, lineHeight: 1.1 },
      },
      subtitle: {
        frame: { x: MARGIN_X, y: 424, w: CONTENT_WIDTH, h: 160 },
        role: "subtitle",
        color: "onAccent",
        align,
        valign: "top",
      },
    },
  };
}

export const SLIDE_LAYOUTS: Record<SlideLayoutId, LayoutSpec> = {
  cover: titleSlide("left"),
  closing: titleSlide("center"),
  section: {
    background: "page",
    decorations: [
      {
        frame: { x: MARGIN_X, y: 272, w: 96, h: 8 },
        shape: "rect",
        fill: "accent",
      },
    ],
    slots: {
      title: {
        frame: { x: MARGIN_X, y: 300, w: CONTENT_WIDTH, h: 140 },
        role: "title",
        color: "text",
        align: "left",
        valign: "top",
        typography: { maxSize: 56, minSize: 32, lineHeight: 1.1 },
      },
      subtitle: {
        frame: { x: MARGIN_X, y: 456, w: CONTENT_WIDTH, h: 120 },
        role: "subtitle",
        color: "muted",
        align: "left",
        valign: "top",
      },
    },
  },
  "title-content": {
    background: "page",
    decorations: [],
    slots: { title: TITLE, body: BODY },
  },
  "two-content": {
    background: "page",
    decorations: [],
    slots: {
      title: TITLE,
      left: { ...BODY, frame: { ...BODY.frame, w: COLUMN_WIDTH } },
      right: {
        ...BODY,
        frame: {
          ...BODY.frame,
          x: MARGIN_X + CONTENT_WIDTH - COLUMN_WIDTH,
          w: COLUMN_WIDTH,
        },
      },
    },
  },
  "title-only": {
    background: "page",
    decorations: [],
    slots: { title: TITLE },
  },
  blank: { background: "page", decorations: [], slots: {} },
};
