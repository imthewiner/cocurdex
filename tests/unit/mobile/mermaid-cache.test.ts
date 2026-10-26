import { createDiagramCache } from "@cocurdex/mobile/internal/markdown/mermaid-cache";
import { describe, expect, it, vi } from "vitest";

const diagram = { svg: "<svg/>", width: 320, height: 120, image: null };

describe("createDiagramCache", () => {
  it("returns a rendered diagram on the next visit without rendering again", () => {
    const cache = createDiagramCache();
    expect(cache.get("graph TD; A-->B", "light")).toBeNull();
    cache.rendered("graph TD; A-->B", "light", diagram);
    const entry = cache.get("graph TD; A-->B", "light");
    expect(entry).toMatchObject({ kind: "rendered", diagram });
    expect(cache.get("graph TD; A-->B", "dark")).toBeNull();
    expect(entry && cache.byId(entry.id)).toBe(entry);
  });

  it("tells subscribers when a diagram finishes or fails", () => {
    const cache = createDiagramCache();
    const listener = vi.fn();
    const unsubscribe = cache.subscribe(listener);
    cache.failed("broken", "dark");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(cache.get("broken", "dark")?.kind).toBe("failed");
    unsubscribe();
    cache.rendered("graph TD; A-->B", "dark", diagram);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("forgets the least recently rendered diagrams beyond its capacity", () => {
    const cache = createDiagramCache(2);
    cache.rendered("a", "light", diagram);
    const first = cache.get("a", "light");
    cache.rendered("b", "light", diagram);
    cache.rendered("c", "light", diagram);
    expect(cache.get("a", "light")).toBeNull();
    expect(first && cache.byId(first.id)).toBeNull();
    expect(cache.get("c", "light")).not.toBeNull();
  });

  it("hands evicted and replaced diagrams to the release callback", () => {
    const released = vi.fn();
    const cache = createDiagramCache(1, released);
    const first = { ...diagram, image: "file:///cache/a.png" };
    cache.rendered("a", "light", first);
    cache.rendered("a", "light", { ...diagram, image: "file:///cache/b.png" });
    expect(released).toHaveBeenCalledWith(first);
    cache.failed("b", "light");
    expect(released).toHaveBeenCalledTimes(2);
  });
});
