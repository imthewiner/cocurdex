import {
  DECK_COLORS,
  DECK_CONTENT_VERSION,
  DECK_THEME_IDS,
  type DeckContent,
  SLIDE_LAYOUT_IDS,
  SLIDE_SLOT_IDS,
} from "@cocurdex/shared";
import { z } from "zod";

const MAX_SLIDES = 500;
const MAX_ELEMENTS = 200;
const MAX_TEXT = 20_000;
const MAX_LEVEL = 4;

const idSchema = z.string().min(1).max(128);
const colorSchema = z.enum(DECK_COLORS);
const coordinateSchema = z.number().finite().min(-10_000).max(10_000);

const frameSchema = z.object({
  x: coordinateSchema,
  y: coordinateSchema,
  w: z.number().finite().positive().max(10_000),
  h: z.number().finite().positive().max(10_000),
});

const runSchema = z.object({
  text: z.string().max(MAX_TEXT),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  strike: z.boolean().optional(),
  code: z.boolean().optional(),
  link: z.string().url().max(2048).optional(),
  color: colorSchema.optional(),
});

const paragraphSchema = z.object({
  runs: z.array(runSchema).max(500),
  list: z.enum(["bullet", "number"]).optional(),
  level: z.number().int().min(0).max(MAX_LEVEL).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
});

const paragraphsSchema = z.array(paragraphSchema).max(200);

const tableSchema = z.object({
  header: z.boolean(),
  rows: z
    .array(
      z
        .array(z.object({ paragraphs: paragraphsSchema }))
        .min(1)
        .max(20),
    )
    .min(1)
    .max(50),
});

const slotContentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), paragraphs: paragraphsSchema }),
  z.object({ kind: z.literal("table"), table: tableSchema }),
]);

const elementSchema = z.discriminatedUnion("kind", [
  z.object({
    id: idSchema,
    kind: z.literal("text"),
    frame: frameSchema,
    role: z.enum(["title", "subtitle", "body", "caption"]),
    paragraphs: paragraphsSchema,
  }),
  z.object({
    id: idSchema,
    kind: z.literal("shape"),
    frame: frameSchema,
    shape: z.enum(["rect", "ellipse"]),
    fill: colorSchema,
  }),
  z.object({
    id: idSchema,
    kind: z.literal("table"),
    frame: frameSchema,
    table: tableSchema,
  }),
]);

const slotIdSchema = z.enum(SLIDE_SLOT_IDS);

const slideSchema = z.object({
  id: idSchema,
  layout: z.enum(SLIDE_LAYOUT_IDS),
  slots: z.partialRecord(slotIdSchema, slotContentSchema),
  slotFrames: z.partialRecord(slotIdSchema, frameSchema).optional(),
  elements: z.array(elementSchema).max(MAX_ELEMENTS),
  notes: z.string().max(MAX_TEXT),
});

export const deckContentSchema = z.object({
  version: z.literal(DECK_CONTENT_VERSION),
  size: z.object({
    width: z.literal(1280),
    height: z.literal(720),
  }),
  theme: z.enum(DECK_THEME_IDS),
  slides: z.array(slideSchema).max(MAX_SLIDES),
}) satisfies z.ZodType<DeckContent>;

export function parseDeckContent(value: unknown): DeckContent {
  return deckContentSchema.parse(value);
}
