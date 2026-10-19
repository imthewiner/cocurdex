import type { DeckColor, SlideLayoutId, TextRole } from "@cocurdex/shared";
import {
  BASE_ROLES,
  type DeckFont,
  type DeckPaint,
  type DeckPaintColor,
  type DeckTheme,
  type GradientStop,
  type LayoutStyle,
  type LinearGradient,
  type PageNumberDecoration,
  type RadialGradient,
  type RoleTypography,
  type ShapeDecoration,
} from "../theme";

type Stop = [color: DeckPaintColor, at: number, opacity?: number];

function stops(list: Stop[]): GradientStop[] {
  return list.map(([color, at, opacity]) => ({
    color,
    at,
    ...(opacity === undefined ? {} : { opacity }),
  }));
}

export function linear(angle: number, ...list: Stop[]): LinearGradient {
  return { kind: "linear", angle, stops: stops(list) };
}

export function radial(...list: Stop[]): RadialGradient {
  return { kind: "radial", stops: stops(list) };
}

export function glow(color: DeckPaintColor, strength: number): RadialGradient {
  return radial([color, 0, strength], [color, 1, 0]);
}

export function rect(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: DeckPaint,
  opacity?: number,
): ShapeDecoration {
  return {
    kind: "shape",
    shape: "rect",
    frame: { x, y, w, h },
    fill,
    ...(opacity === undefined ? {} : { opacity }),
  };
}

export function ellipse(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: DeckPaint,
  opacity?: number,
): ShapeDecoration {
  return { ...rect(x, y, w, h, fill, opacity), shape: "ellipse" };
}

export function pageNumber(
  color: DeckColor,
  font: DeckFont,
): PageNumberDecoration {
  return {
    kind: "pageNumber",
    frame: { x: 1080, y: 664, w: 120, h: 32 },
    color,
    font,
    size: 14,
    align: "right",
  };
}

type ContentLayoutId = Exclude<SlideLayoutId, "cover" | "closing" | "section">;

export function contentLayouts(
  content: LayoutStyle,
  blank: LayoutStyle,
): Record<ContentLayoutId, LayoutStyle> {
  return {
    "title-content": content,
    "two-content": content,
    "title-only": content,
    blank,
  };
}

export interface ThemeDefinition {
  colors: Record<DeckColor, string>;
  tableBorder: string;
  fonts?: DeckTheme["fonts"];
  roles?: Partial<Record<TextRole, Partial<RoleTypography>>>;
  layouts: Record<SlideLayoutId, LayoutStyle>;
}

export function defineTheme(definition: ThemeDefinition): DeckTheme {
  const roles = Object.fromEntries(
    Object.entries(BASE_ROLES).map(([role, base]) => [
      role,
      { ...base, ...definition.roles?.[role as TextRole] },
    ]),
  ) as Record<TextRole, RoleTypography>;
  return {
    colors: definition.colors,
    tableBorder: definition.tableBorder,
    fonts: definition.fonts ?? { heading: "sans", body: "sans" },
    roles,
    layouts: definition.layouts,
  };
}
