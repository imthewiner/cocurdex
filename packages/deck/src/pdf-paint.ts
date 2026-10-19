import type { SlideFrame } from "@cocurdex/shared";
import {
  type DeckPaint,
  type DeckTheme,
  type GradientStop,
  isGradient,
  paintHex,
} from "./theme";

type Doc = PDFKit.PDFDocument;
type Gradient = ReturnType<Doc["linearGradient"]>;
type Shape = "rect" | "ellipse";

function addStops(
  gradient: Gradient,
  stops: GradientStop[],
  theme: DeckTheme,
  opacity: number,
) {
  for (const stop of stops) {
    gradient.stop(
      stop.at,
      `#${paintHex(theme, stop.color)}`,
      (stop.opacity ?? 1) * opacity,
    );
  }
  return gradient;
}

function tracePath(doc: Doc, shape: Shape, frame: SlideFrame) {
  const { x, y, w, h } = frame;
  if (shape === "ellipse") doc.ellipse(x + w / 2, y + h / 2, w / 2, h / 2);
  else doc.rect(x, y, w, h);
}

export function linearGradientLine(angle: number, frame: SlideFrame) {
  const radians = (angle * Math.PI) / 180;
  const dx = Math.sin(radians);
  const dy = -Math.cos(radians);
  const half = (Math.abs(frame.w * dx) + Math.abs(frame.h * dy)) / 2;
  const cx = frame.x + frame.w / 2;
  const cy = frame.y + frame.h / 2;
  return {
    x1: cx - dx * half,
    y1: cy - dy * half,
    x2: cx + dx * half,
    y2: cy + dy * half,
  };
}

export function fillPaint(
  doc: Doc,
  theme: DeckTheme,
  paint: DeckPaint,
  frame: SlideFrame,
  shape: Shape = "rect",
  opacity = 1,
) {
  doc.save();
  if (!isGradient(paint)) {
    tracePath(doc, shape, frame);
    doc.fillOpacity(opacity).fill(`#${paintHex(theme, paint)}`);
  } else if (paint.kind === "linear") {
    const line = linearGradientLine(paint.angle, frame);
    const gradient = doc.linearGradient(line.x1, line.y1, line.x2, line.y2);
    tracePath(doc, shape, frame);
    doc.fill(addStops(gradient, paint.stops, theme, opacity));
  } else {
    doc.translate(frame.x + frame.w / 2, frame.y + frame.h / 2);
    doc.scale(frame.w / 2, frame.h / 2);
    const gradient = doc.radialGradient(0, 0, 0, 0, 0, 1);
    if (shape === "ellipse") doc.circle(0, 0, 1);
    else doc.rect(-1, -1, 2, 2);
    doc.fill(addStops(gradient, paint.stops, theme, opacity));
  }
  doc.restore();
}
