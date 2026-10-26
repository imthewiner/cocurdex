import {
  diagramColors,
  renderNativeDiagram,
  rendersNatively,
} from "@cocurdex/mobile/internal/markdown/native-mermaid";
import { describe, expect, it } from "vitest";

const PALETTE = { background: "#ffffff", foreground: "#000000" };
const MONO = "monospace";

describe("rendersNatively", () => {
  it("accepts the diagram types drawn without a web view", () => {
    expect(rendersNatively("graph TD\n  A --> B")).toBe(true);
    expect(rendersNatively("\n  flowchart LR\n  A --> B")).toBe(true);
    expect(rendersNatively("sequenceDiagram\n  A->>B: hi")).toBe(true);
    expect(rendersNatively("stateDiagram-v2\n  [*] --> A")).toBe(true);
    expect(rendersNatively("classDiagram\n  A <|-- B")).toBe(true);
    expect(rendersNatively("erDiagram\n  A ||--o{ B : has")).toBe(true);
  });

  it("leaves other diagrams and configured diagrams to the web renderer", () => {
    expect(rendersNatively('pie\n  "a": 1')).toBe(false);
    expect(rendersNatively("xychart-beta\n  bar [1, 2]")).toBe(false);
    expect(rendersNatively("%%{init: {}}%%\ngraph TD\n  A --> B")).toBe(false);
    expect(rendersNatively("---\ntitle: x\n---\ngraph TD")).toBe(false);
  });
});

describe("diagramColors", () => {
  it("derives every diagram color from the background and foreground", () => {
    const colors = diagramColors(PALETTE);
    expect(colors["--_line"]).toBe("#808080");
    expect(colors["--_text"]).toBe("#000000");
    expect(colors["--_group-fill"]).toBe("#ffffff");
  });
});

describe("renderNativeDiagram", () => {
  it("draws a flowchart as a self-contained SVG with concrete colors", () => {
    const output = renderNativeDiagram(
      "graph TD\n  A[Cart] --> B{Discount?}\n  B -->|yes| C[Apply]",
      PALETTE,
      MONO,
    );
    expect(output).not.toBeNull();
    expect(output?.width).toBeGreaterThan(0);
    expect(output?.height).toBeGreaterThan(0);
    expect(output?.svg).not.toContain("var(");
    expect(output?.svg).not.toContain("<style");
    expect(output?.svg).not.toContain("@import");
    expect(output?.svg).toContain("Discount?");
    expect(output?.png).toBeNull();
  });

  it("sets the monospace font on class members", () => {
    const output = renderNativeDiagram(
      "classDiagram\n  class Animal {\n    +String name\n  }",
      PALETTE,
      MONO,
    );
    expect(output?.svg).toContain(`font-family="${MONO}"`);
  });

  it("returns nothing for diagrams it cannot draw so the web renderer takes over", () => {
    expect(renderNativeDiagram('pie\n  "a": 1', PALETTE, MONO)).toBeNull();
  });
});
