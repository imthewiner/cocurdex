import type { DeckTheme } from "@cocurdex/deck";
import type { DeckColor, SlideFrame } from "@cocurdex/shared";
import type { CSSProperties } from "react";

const SLIDE_WIDTH = 1280;
const SLIDE_HEIGHT = 720;
const FALLBACK_SANS =
  '"Helvetica Neue", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
const FALLBACK_MONO = "ui-monospace, Menlo, Consolas, monospace";

export function slideLength(px: number): string {
  return `${((px / SLIDE_WIDTH) * 100).toFixed(4)}cqw`;
}

export function frameStyle(frame: SlideFrame): CSSProperties {
  return {
    left: `${(frame.x / SLIDE_WIDTH) * 100}%`,
    top: `${(frame.y / SLIDE_HEIGHT) * 100}%`,
    width: `${(frame.w / SLIDE_WIDTH) * 100}%`,
    height: `${(frame.h / SLIDE_HEIGHT) * 100}%`,
  };
}

export function themeColor(theme: DeckTheme, token: DeckColor): string {
  return `#${theme.colors[token]}`;
}

export function sansFontStack(theme: DeckTheme): string {
  return `"${theme.fontFamily}", ${FALLBACK_SANS}`;
}

export function monoFontStack(theme: DeckTheme): string {
  return `"${theme.monoFontFamily}", ${FALLBACK_MONO}`;
}
