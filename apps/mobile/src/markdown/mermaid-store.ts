import type { MermaidAppearance } from "@cocurdex/shared";
import { useSyncExternalStore } from "react";
import { createDiagramCache } from "./mermaid-cache";
import { releaseImage } from "./mermaid-images";

export const diagrams = createDiagramCache(undefined, releaseImage);

export function useDiagram(source: string, appearance: MermaidAppearance) {
  return useSyncExternalStore(diagrams.subscribe, () =>
    diagrams.get(source, appearance),
  );
}

export function useDiagramById(id: string) {
  return useSyncExternalStore(diagrams.subscribe, () => diagrams.byId(id));
}
