import { systemPdfFonts } from "@cocurdex/daemon/internal/decks/deck-service";
import { compileDeckMarkdown } from "@cocurdex/deck/markdown";
import { exportDeckToPdf } from "@cocurdex/deck/pdf";
import { describe, expect, it } from "vitest";

const MARKDOWN = `# Checkout review

Acme Shop · 结账评审

---

## Discount codes

- Fixed amount codes are **live**
- 百分比折扣码 *in review*
  - \`SPRING10\` takes 10% off

---

## Rollout

| Code | Status |
| --- | --- |
| SPRING10 | Live |
`;

function pageBoxes(pdf: Buffer): string[] {
  return [...pdf.toString("latin1").matchAll(/\/MediaBox \[([^\]]+)\]/g)].map(
    (match) => (match[1] ?? "").trim(),
  );
}

describe("deck PDF export", () => {
  it("finds a usable system font on this host", () => {
    expect(systemPdfFonts()).not.toBeNull();
  });

  it("renders one 16:9 page per slide", async () => {
    const fonts = systemPdfFonts();
    if (!fonts) throw new Error("No system font");
    const { content } = compileDeckMarkdown(MARKDOWN);
    const pdf = await exportDeckToPdf(
      content,
      { title: "Checkout review" },
      fonts,
    );
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pageBoxes(pdf)).toEqual(Array(3).fill("0 0 960 540"));
  });
});
