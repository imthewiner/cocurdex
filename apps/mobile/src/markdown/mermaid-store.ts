import type { MermaidAppearance } from "@cocurdex/shared";
import { useCallback, useSyncExternalStore } from "react";
import { createDiagramCache } from "./mermaid-cache";
import { cachedDiagram, saveDiagram } from "./mermaid-images";
import { createMermaidRenderer } from "./mermaid-renderer";

export const diagrams = createDiagramCache();

export const mermaidRenderer = createMermaidRenderer({
  known: ({ source, appearance }) => diagrams.get(source, appearance) !== null,
  cached: cachedDiagram,
  save: saveDiagram,
  rendered: ({ source, appearance }, diagram) =>
    diagrams.rendered(source, appearance, diagram),
  failed: ({ source, appearance }) => diagrams.failed(source, appearance),
});

export function useDiagram(source: string, appearance: MermaidAppearance) {
  const subscribe = useCallback(
    (listener: () => void) => {
      const unsubscribe = diagrams.subscribe(listener);
      mermaidRenderer.request({ source, appearance });
      return unsubscribe;
    },
    [source, appearance],
  );
  return useSyncExternalStore(subscribe, () =>
    diagrams.get(source, appearance),
  );
}

export function useDiagramById(id: string) {
  return useSyncExternalStore(diagrams.subscribe, () => diagrams.byId(id));
}
