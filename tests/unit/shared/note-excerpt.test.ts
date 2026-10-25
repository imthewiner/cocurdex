import { noteExcerpt } from "@cocurdex/shared";
import { describe, expect, it } from "vitest";

describe("noteExcerpt", () => {
  it("reads the first prose after headings, code, and markup", () => {
    expect(
      noteExcerpt(
        [
          "# Title",
          "",
          "```ts",
          "const hidden = true;",
          "```",
          "> - [x] Ship `codes` with __care__ and [[Pricing|price rules]]",
        ].join("\r\n"),
      ),
    ).toBe("Ship codes with care and price rules");
  });

  it("returns nothing for a body without prose", () => {
    expect(noteExcerpt("")).toBeNull();
    expect(noteExcerpt("## Only a heading\n\n---")).toBeNull();
  });

  it("cuts long prose with an ellipsis", () => {
    const excerpt = noteExcerpt("word ".repeat(100)) ?? "";
    expect(excerpt.length).toBeLessThanOrEqual(160);
    expect(excerpt.endsWith("…")).toBe(true);
  });
});
