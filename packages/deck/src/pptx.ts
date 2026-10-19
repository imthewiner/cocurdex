import {
  type DeckColor,
  type DeckContent,
  SLIDE_LAYOUT_IDS,
  SLIDE_SLOT_IDS,
  type SlideFrame,
  type SlideLayoutId,
  type TableData,
  type TextParagraph,
} from "@cocurdex/shared";
import PptxGenJS from "pptxgenjs";
import { SLIDE_LAYOUTS } from "./layouts";
import {
  type ResolvedItem,
  type ResolvedTable,
  type ResolvedText,
  resolveSlide,
} from "./resolve";
import { TABLE_CELL_PADDING, TEXT_INSET } from "./text-fit";
import { type DeckTheme, deckTheme } from "./theme";

const PX_PER_INCH = 96;
const PT_PER_PX = 0.75;
const PARAGRAPH_GAP_EM = 0.3;

type TextProps = PptxGenJS.TextProps;
type Slide = PptxGenJS.Slide;

function inches(px: number): number {
  return Number((px / PX_PER_INCH).toFixed(4));
}

function points(px: number): number {
  return Number((px * PT_PER_PX).toFixed(2));
}

function position(frame: SlideFrame) {
  return {
    x: inches(frame.x),
    y: inches(frame.y),
    w: inches(frame.w),
    h: inches(frame.h),
  };
}

function color(theme: DeckTheme, token: DeckColor): string {
  return theme.colors[token];
}

function paragraphOptions(paragraph: TextParagraph): TextProps["options"] {
  const options: NonNullable<TextProps["options"]> = {};
  if (paragraph.list === "bullet") options.bullet = true;
  if (paragraph.list === "number") options.bullet = { type: "number" };
  if (paragraph.list) options.indentLevel = paragraph.level ?? 0;
  if (paragraph.align) options.align = paragraph.align;
  return options;
}

function paragraphsToRuns(
  paragraphs: TextParagraph[],
  theme: DeckTheme,
  baseColor: DeckColor,
): TextProps[] {
  const props: TextProps[] = [];
  paragraphs.forEach((paragraph, paragraphIndex) => {
    const shared = paragraphOptions(paragraph);
    const runs = paragraph.runs.length > 0 ? paragraph.runs : [{ text: "" }];
    runs.forEach((run, runIndex) => {
      const pieces = run.text.split("\n");
      pieces.forEach((piece, pieceIndex) => {
        const isLast =
          runIndex === runs.length - 1 && pieceIndex === pieces.length - 1;
        props.push({
          text: piece,
          options: {
            ...shared,
            bold: run.bold,
            italic: run.italic,
            underline: run.underline ? { style: "sng" } : undefined,
            strike: run.strike ? "sngStrike" : undefined,
            fontFace: run.code ? theme.monoFontFamily : undefined,
            color: color(theme, run.color ?? baseColor),
            hyperlink: run.link ? { url: run.link } : undefined,
            softBreakBefore: pieceIndex > 0 ? true : undefined,
            breakLine:
              isLast && paragraphIndex < paragraphs.length - 1
                ? true
                : undefined,
          },
        });
      });
    });
  });
  return props;
}

function textOptions(item: ResolvedText, theme: DeckTheme) {
  return {
    fontFace: theme.fontFamily,
    fontSize: points(item.fontSize),
    color: color(theme, item.color),
    bold: item.bold,
    align: item.align,
    valign: item.valign,
    lineSpacingMultiple: item.lineHeight,
    paraSpaceAfter: points(item.fontSize * PARAGRAPH_GAP_EM),
    margin: points(TEXT_INSET),
    fit: "shrink" as const,
  };
}

function tableRows(
  item: ResolvedTable,
  theme: DeckTheme,
): PptxGenJS.TableRow[] {
  return item.table.rows.map((row, rowIndex) =>
    row.map((cell) => {
      const isHeader = item.table.header && rowIndex === 0;
      return {
        text: paragraphsToRuns(cell.paragraphs, theme, "text"),
        options: {
          bold: isHeader || undefined,
          fill: isHeader ? { color: color(theme, "surface") } : undefined,
        },
      };
    }),
  );
}

function addTable(slide: Slide, item: ResolvedTable, theme: DeckTheme) {
  const columns = Math.max(1, ...item.table.rows.map((row) => row.length));
  const frame = position(item.frame);
  slide.addTable(tableRows(item, theme), {
    ...frame,
    h: undefined,
    colW: Array.from({ length: columns }, () =>
      Number((frame.w / columns).toFixed(4)),
    ),
    fontFace: theme.fontFamily,
    fontSize: points(item.fontSize),
    color: color(theme, "text"),
    valign: "top",
    margin: points(TABLE_CELL_PADDING),
    border: { type: "solid", pt: 0.75, color: "D0D7DE" },
  });
}

function placeholderName(layout: SlideLayoutId, slot: string): string {
  return `${layout}-${slot}`;
}

function defineMasters(pptx: PptxGenJS, theme: DeckTheme) {
  for (const layoutId of SLIDE_LAYOUT_IDS) {
    const layout = SLIDE_LAYOUTS[layoutId];
    const objects: PptxGenJS.SlideMasterProps["objects"] =
      layout.decorations.map((decoration) => ({
        rect: {
          ...position(decoration.frame),
          fill: { color: color(theme, decoration.fill) },
        },
      }));
    for (const slot of SLIDE_SLOT_IDS) {
      const spec = layout.slots[slot];
      if (!spec) continue;
      objects.push({
        placeholder: {
          options: {
            name: placeholderName(layoutId, slot),
            type: slot === "title" ? "title" : "body",
            ...position(spec.frame),
            fontFace: theme.fontFamily,
            fontSize: points(theme.roles[spec.role].maxSize),
            color: color(theme, spec.color),
            align: spec.align,
            valign: spec.valign,
          },
          text: "",
        },
      });
    }
    pptx.defineSlideMaster({
      title: layoutId,
      background: { color: color(theme, layout.background) },
      objects,
    });
  }
}

function isAtLayoutFrame(layout: SlideLayoutId, item: ResolvedText): boolean {
  if (item.source.kind !== "slot") return false;
  const frame = SLIDE_LAYOUTS[layout].slots[item.source.slot]?.frame;
  return (
    !!frame &&
    frame.x === item.frame.x &&
    frame.y === item.frame.y &&
    frame.w === item.frame.w &&
    frame.h === item.frame.h
  );
}

function addItem(
  slide: Slide,
  layout: SlideLayoutId,
  item: ResolvedItem,
  theme: DeckTheme,
) {
  if (item.kind === "shape") {
    if (item.source.kind === "decoration") return;
    slide.addShape(item.shape === "ellipse" ? "ellipse" : "rect", {
      ...position(item.frame),
      fill: { color: color(theme, item.fill) },
      line: { type: "none" },
    });
    return;
  }
  if (item.kind === "table") {
    addTable(slide, item, theme);
    return;
  }
  const runs = paragraphsToRuns(item.paragraphs, theme, item.color);
  const options = textOptions(item, theme);
  if (item.source.kind === "slot" && isAtLayoutFrame(layout, item)) {
    slide.addText(runs, {
      ...options,
      placeholder: placeholderName(layout, item.source.slot),
    });
    return;
  }
  slide.addText(runs, { ...options, ...position(item.frame) });
}

export async function exportDeckToPptx(
  deck: DeckContent,
  meta: { title: string },
): Promise<Buffer> {
  const theme = deckTheme(deck.theme);
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = meta.title;
  pptx.theme = {
    headFontFace: theme.fontFamily,
    bodyFontFace: theme.fontFamily,
  };
  defineMasters(pptx, theme);
  for (const slide of deck.slides) {
    const resolved = resolveSlide(slide, deck);
    const target = pptx.addSlide({ masterName: slide.layout });
    for (const item of resolved.items) {
      addItem(target, slide.layout, item, theme);
    }
    if (resolved.notes) target.addNotes(resolved.notes);
  }
  const output = await pptx.write({
    outputType: "nodebuffer",
    compression: true,
  });
  return output as Buffer;
}
