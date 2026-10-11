import { type CSSProperties, useMemo, useState } from "react";
import type { ThemedToken } from "shiki";
import { useMountEffect, useResolvedTheme } from "@/lib";
import {
  codeToTokenLines,
  getCodeThemeId,
  loadCodeHighlighter,
} from "./code-textarea-highlighter";

const DEFAULT_MAX_HIGHLIGHT_LENGTH = 6000;

const ITALIC = 1;
const BOLD = 2;

export function shellTokenStyle(token: ThemedToken): CSSProperties {
  const fontStyle = token.fontStyle ?? 0;
  return {
    color: token.color,
    fontStyle: fontStyle & ITALIC ? "italic" : undefined,
    fontWeight: fontStyle & BOLD ? 700 : undefined,
  };
}

export function useShellTokenLines(
  code: string,
  maxLength = DEFAULT_MAX_HIGHLIGHT_LENGTH,
) {
  const resolvedTheme = useResolvedTheme();
  const [highlighter, setHighlighter] = useState<Awaited<
    ReturnType<typeof loadCodeHighlighter>
  > | null>(null);

  useMountEffect(() => {
    let cancelled = false;
    void loadCodeHighlighter()
      .then((instance) => {
        if (!cancelled) {
          setHighlighter(instance);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  });

  return useMemo(() => {
    if (!highlighter || code.length === 0 || code.length > maxLength) {
      return null;
    }
    try {
      return codeToTokenLines(highlighter, code, getCodeThemeId(resolvedTheme));
    } catch {
      return null;
    }
  }, [code, highlighter, maxLength, resolvedTheme]);
}
