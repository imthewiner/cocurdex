import type {
  DeckColor,
  DeckContent,
  SlideFrame,
  TableData,
  TextParagraph,
  TextRun,
} from "@cocurdex/shared";
import PDFDocument from "pdfkit";
import { listMarkers } from "./list-markers";
import { type ResolvedItem, resolveSlide } from "./resolve";
import {
  LIST_INDENT_EM,
  PARAGRAPH_GAP_EM,
  paragraphIndentEm,
  TABLE_CELL_PADDING,
  TEXT_INSET,
} from "./text-fit";
import { type DeckTheme, deckTheme } from "./theme";

export interface PdfFontSource {
  path: string;
  face?: string;
}

export interface PdfFontSet {
  regular: PdfFontSource;
  bold?: PdfFontSource;
  mono?: PdfFontSource;
}

type Doc = PDFKit.PDFDocument;

const PT_PER_PX = 0.75;
const SYNTHETIC_BOLD_STROKE_EM = 0.03;
const TABLE_BORDER_COLOR = "#D0D7DE";
const FONT = { regular: "deck-regular", bold: "deck-bold", mono: "deck-mono" };

interface TextStyle {
  fontSize: number;
  lineHeight: number;
  color: DeckColor;
  bold: boolean;
  align: "left" | "center";
}

interface Painter {
  doc: Doc;
  theme: DeckTheme;
  fonts: PdfFontSet;
}

function hex(theme: DeckTheme, token: DeckColor): string {
  return `#${theme.colors[token]}`;
}

function registerFonts(doc: Doc, fonts: PdfFontSet) {
  doc.registerFont(FONT.regular, fonts.regular.path, fonts.regular.face);
  if (fonts.bold) doc.registerFont(FONT.bold, fonts.bold.path, fonts.bold.face);
  if (fonts.mono) doc.registerFont(FONT.mono, fonts.mono.path, fonts.mono.face);
}

function fontFor(painter: Painter, run: TextRun, style: TextStyle) {
  if (run.code && painter.fonts.mono) return FONT.mono;
  if ((run.bold || style.bold) && painter.fonts.bold) return FONT.bold;
  return FONT.regular;
}

function useLineHeight(painter: Painter, style: TextStyle) {
  const { doc } = painter;
  doc.font(FONT.regular).fontSize(style.fontSize);
  const natural = doc.currentLineHeight(false);
  return Math.max(0, style.fontSize * style.lineHeight - natural);
}

function paragraphText(paragraph: TextParagraph): string {
  return paragraph.runs.map((run) => run.text).join("") || " ";
}

function paragraphHeight(
  painter: Painter,
  paragraph: TextParagraph,
  width: number,
  style: TextStyle,
): number {
  const lineGap = useLineHeight(painter, style);
  const indent = paragraphIndentEm(paragraph) * style.fontSize;
  return painter.doc.heightOfString(paragraphText(paragraph), {
    width: Math.max(1, width - indent),
    lineGap,
  });
}

function paragraphsHeight(
  painter: Painter,
  paragraphs: TextParagraph[],
  width: number,
  style: TextStyle,
): number {
  const gaps = Math.max(0, paragraphs.length - 1) * PARAGRAPH_GAP_EM;
  return paragraphs.reduce(
    (total, paragraph) =>
      total + paragraphHeight(painter, paragraph, width, style),
    gaps * style.fontSize,
  );
}

function drawRuns(
  painter: Painter,
  paragraph: TextParagraph,
  box: { x: number; y: number; w: number },
  style: TextStyle,
  lineGap: number,
) {
  const { doc, theme } = painter;
  const runs = paragraph.runs.length > 0 ? paragraph.runs : [{ text: " " }];
  runs.forEach((run, index) => {
    const bold = run.bold || style.bold;
    const synthetic = bold && !painter.fonts.bold && !run.code;
    const color = hex(theme, run.color ?? style.color);
    doc
      .font(fontFor(painter, run, style))
      .fontSize(style.fontSize)
      .fillColor(color)
      .strokeColor(color)
      .lineWidth(style.fontSize * SYNTHETIC_BOLD_STROKE_EM);
    const options: PDFKit.Mixins.TextOptions = {
      width: box.w,
      lineGap,
      align: paragraph.align ?? style.align,
      continued: index < runs.length - 1,
      underline: run.underline || Boolean(run.link),
      strike: run.strike,
      oblique: run.italic,
      link: run.link,
      fill: true,
      stroke: synthetic,
    };
    if (index === 0) doc.text(run.text, box.x, box.y, options);
    else doc.text(run.text, options);
  });
}

function drawParagraphs(
  painter: Painter,
  paragraphs: TextParagraph[],
  box: { x: number; y: number; w: number },
  style: TextStyle,
) {
  const { doc, theme } = painter;
  const markers = listMarkers(paragraphs);
  let y = box.y;
  paragraphs.forEach((paragraph, index) => {
    const lineGap = useLineHeight(painter, style);
    const indent = paragraphIndentEm(paragraph) * style.fontSize;
    const marker = markers[index];
    if (marker) {
      const level = paragraph.level ?? 0;
      doc
        .font(style.bold && painter.fonts.bold ? FONT.bold : FONT.regular)
        .fontSize(style.fontSize)
        .fillColor(hex(theme, style.color))
        .text(marker, box.x + level * LIST_INDENT_EM * style.fontSize, y, {
          lineBreak: false,
          lineGap,
        });
    }
    const width = Math.max(1, box.w - indent);
    drawRuns(
      painter,
      paragraph,
      { x: box.x + indent, y, w: width },
      style,
      lineGap,
    );
    y +=
      paragraphHeight(painter, paragraph, box.w, style) +
      PARAGRAPH_GAP_EM * style.fontSize;
  });
}

function clipTo(doc: Doc, frame: SlideFrame, draw: () => void) {
  doc.save();
  doc.rect(frame.x, frame.y, frame.w, frame.h).clip();
  draw();
  doc.restore();
}

function drawText(
  painter: Painter,
  item: Extract<ResolvedItem, { kind: "text" }>,
) {
  const style: TextStyle = {
    fontSize: item.fontSize,
    lineHeight: item.lineHeight,
    color: item.color,
    bold: item.bold,
    align: item.align,
  };
  const inner = {
    x: item.frame.x + TEXT_INSET,
    y: item.frame.y + TEXT_INSET,
    w: item.frame.w - TEXT_INSET * 2,
    h: item.frame.h - TEXT_INSET * 2,
  };
  const height = paragraphsHeight(painter, item.paragraphs, inner.w, style);
  const free = Math.max(0, inner.h - height);
  const offset = { top: 0, middle: free / 2, bottom: free }[item.valign];
  clipTo(painter.doc, item.frame, () =>
    drawParagraphs(
      painter,
      item.paragraphs,
      { x: inner.x, y: inner.y + offset, w: inner.w },
      style,
    ),
  );
}

function tableRowHeights(
  painter: Painter,
  table: TableData,
  cellWidth: number,
  style: TextStyle,
): number[] {
  return table.rows.map((row, rowIndex) => {
    const cellStyle = { ...style, bold: table.header && rowIndex === 0 };
    const tallest = Math.max(
      0,
      ...row.map((cell) =>
        paragraphsHeight(painter, cell.paragraphs, cellWidth, cellStyle),
      ),
    );
    return tallest + TABLE_CELL_PADDING * 2;
  });
}

function drawTable(
  painter: Painter,
  item: Extract<ResolvedItem, { kind: "table" }>,
) {
  const { doc, theme } = painter;
  const { table, frame } = item;
  const columns = Math.max(1, ...table.rows.map((row) => row.length));
  const columnWidth = frame.w / columns;
  const style: TextStyle = {
    fontSize: item.fontSize,
    lineHeight: item.lineHeight,
    color: "text",
    bold: false,
    align: "left",
  };
  const heights = tableRowHeights(
    painter,
    table,
    columnWidth - TABLE_CELL_PADDING * 2,
    style,
  );
  let y = frame.y;
  table.rows.forEach((row, rowIndex) => {
    const height = heights[rowIndex] ?? 0;
    const isHeader = table.header && rowIndex === 0;
    for (let column = 0; column < columns; column += 1) {
      const x = frame.x + column * columnWidth;
      if (isHeader) {
        doc.rect(x, y, columnWidth, height).fill(hex(theme, "surface"));
      }
      doc
        .rect(x, y, columnWidth, height)
        .lineWidth(1)
        .stroke(TABLE_BORDER_COLOR);
      const cell = row[column];
      if (!cell) continue;
      drawParagraphs(
        painter,
        cell.paragraphs,
        {
          x: x + TABLE_CELL_PADDING,
          y: y + TABLE_CELL_PADDING,
          w: columnWidth - TABLE_CELL_PADDING * 2,
        },
        { ...style, bold: isHeader },
      );
    }
    y += height;
  });
}

function drawShape(
  painter: Painter,
  item: Extract<ResolvedItem, { kind: "shape" }>,
) {
  const { doc, theme } = painter;
  const { x, y, w, h } = item.frame;
  if (item.shape === "ellipse") {
    doc.ellipse(x + w / 2, y + h / 2, w / 2, h / 2).fill(hex(theme, item.fill));
    return;
  }
  doc.rect(x, y, w, h).fill(hex(theme, item.fill));
}

function drawItem(painter: Painter, item: ResolvedItem) {
  if (item.kind === "shape") drawShape(painter, item);
  else if (item.kind === "table") drawTable(painter, item);
  else drawText(painter, item);
}

function collect(doc: Doc): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

export async function exportDeckToPdf(
  deck: DeckContent,
  meta: { title: string },
  fonts: PdfFontSet,
): Promise<Buffer> {
  const { width, height } = deck.size;
  const doc = new PDFDocument({
    autoFirstPage: false,
    font: null as unknown as string,
    info: { Title: meta.title },
  });
  const output = collect(doc);
  registerFonts(doc, fonts);
  const painter: Painter = { doc, theme: deckTheme(deck.theme), fonts };
  for (const slide of deck.slides) {
    const resolved = resolveSlide(slide, deck);
    doc.addPage({ size: [width * PT_PER_PX, height * PT_PER_PX], margin: 0 });
    doc.save();
    doc.scale(PT_PER_PX);
    doc.rect(0, 0, width, height).fill(hex(painter.theme, resolved.background));
    for (const item of resolved.items) drawItem(painter, item);
    doc.restore();
  }
  doc.end();
  return output;
}

export function canLoadPdfFont(source: PdfFontSource): boolean {
  try {
    const doc = new PDFDocument({
      autoFirstPage: false,
      font: null as unknown as string,
    });
    doc.registerFont("probe", source.path, source.face);
    doc.font("probe");
    return true;
  } catch {
    return false;
  }
}
