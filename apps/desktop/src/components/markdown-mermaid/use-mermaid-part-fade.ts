import { useLayoutEffect, useRef } from "react";
import { collectMermaidParts, newMermaidParts } from "./mermaid-parts";

const FADE_MS = 180;

export function useMermaidPartFade(svg: string | null, streaming: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousKeys = useRef<ReadonlySet<string>>(new Set());

  useLayoutEffect(() => {
    const root = containerRef.current?.querySelector("svg");
    if (!svg || !root) {
      return;
    }
    const parts = collectMermaidParts(root);
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (streaming && !reducedMotion) {
      for (const element of newMermaidParts(parts, previousKeys.current)) {
        element.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: FADE_MS,
          easing: "ease-out",
        });
      }
    }
    previousKeys.current = new Set(parts.keys());
  }, [svg, streaming]);

  return containerRef;
}
