import type { MermaidAppearance } from "@cocurdex/shared";
import { useSyncExternalStore } from "react";

export type RenderedDiagram = { svg: string; width: number; height: number };

export type DiagramEntry =
  | { kind: "rendered"; id: string; diagram: RenderedDiagram }
  | { kind: "failed"; id: string };

const DEFAULT_CAPACITY = 64;

export function createDiagramCache(capacity = DEFAULT_CAPACITY) {
  const entries = new Map<string, DiagramEntry>();
  const ids = new Map<string, string>();
  const listeners = new Set<() => void>();
  let nextId = 0;

  const keyOf = (source: string, appearance: MermaidAppearance) =>
    `${appearance}\n${source}`;

  function store(key: string, entry: DiagramEntry) {
    entries.delete(key);
    entries.set(key, entry);
    ids.set(entry.id, key);
    for (const [oldest, evicted] of entries) {
      if (entries.size <= capacity) break;
      entries.delete(oldest);
      ids.delete(evicted.id);
    }
    for (const listener of [...listeners]) listener();
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get(source: string, appearance: MermaidAppearance) {
      return entries.get(keyOf(source, appearance)) ?? null;
    },
    byId(id: string) {
      const key = ids.get(id);
      return key ? (entries.get(key) ?? null) : null;
    },
    rendered(
      source: string,
      appearance: MermaidAppearance,
      diagram: RenderedDiagram,
    ) {
      nextId += 1;
      store(keyOf(source, appearance), {
        kind: "rendered",
        id: String(nextId),
        diagram,
      });
    },
    failed(source: string, appearance: MermaidAppearance) {
      nextId += 1;
      store(keyOf(source, appearance), { kind: "failed", id: String(nextId) });
    },
  };
}

export const diagrams = createDiagramCache();

export function useDiagram(source: string, appearance: MermaidAppearance) {
  return useSyncExternalStore(diagrams.subscribe, () =>
    diagrams.get(source, appearance),
  );
}

export function useDiagramById(id: string) {
  return useSyncExternalStore(diagrams.subscribe, () => diagrams.byId(id));
}
