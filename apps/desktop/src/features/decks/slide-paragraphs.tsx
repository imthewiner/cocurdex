import type { DeckTheme } from "@cocurdex/deck";
import type { TextParagraph, TextRun } from "@cocurdex/shared";
import type { CSSProperties } from "react";
import { listMarkers } from "./list-markers";
import { monoFontStack, themeColor } from "./slide-geometry";

const LIST_INDENT_EM = 1.25;

function runStyle(run: TextRun, theme: DeckTheme): CSSProperties {
  const decorations = [
    run.underline || run.link ? "underline" : "",
    run.strike ? "line-through" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return {
    fontWeight: run.bold ? 700 : undefined,
    fontStyle: run.italic ? "italic" : undefined,
    textDecorationLine: decorations || undefined,
    fontFamily: run.code ? monoFontStack(theme) : undefined,
    color: run.color ? themeColor(theme, run.color) : undefined,
  };
}

export function SlideParagraphs({
  paragraphs,
  theme,
}: {
  paragraphs: TextParagraph[];
  theme: DeckTheme;
}) {
  const markers = listMarkers(paragraphs);
  return paragraphs.map((paragraph, paragraphIndex) => {
    const level = paragraph.level ?? 0;
    const marker = markers[paragraphIndex];
    const indent = paragraph.list ? level + 1 : level;
    return (
      <p
        // biome-ignore lint/suspicious/noArrayIndexKey: paragraphs have no identity beyond their position
        key={paragraphIndex}
        className="relative m-0 whitespace-pre-wrap break-words"
        style={{
          marginBlockEnd: "0.3em",
          paddingInlineStart: `${indent * LIST_INDENT_EM}em`,
          textAlign: paragraph.align,
        }}
      >
        {marker ? (
          <span
            aria-hidden
            className="absolute"
            style={{ insetInlineStart: `${level * LIST_INDENT_EM}em` }}
          >
            {marker}
          </span>
        ) : null}
        {paragraph.runs.map((run, runIndex) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: runs have no identity beyond their position
          <span key={runIndex} style={runStyle(run, theme)}>
            {run.text}
          </span>
        ))}
        {paragraph.runs.length === 0 ? "​" : null}
      </p>
    );
  });
}
