import { compileDeckMarkdown } from "@cocurdex/deck/markdown";
import { exportDeckToPptx } from "@cocurdex/deck/pptx";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

const MARKDOWN = [
  "# Launch plan",
  "Platform team",
  "---",
  "## Highlights",
  "- Sync shipped",
  "  - p95 down",
  "",
  "Notes: Lead with latency.",
  "---",
  "## Numbers",
  "| Metric | Value |",
  "| --- | --- |",
  "| p95 | 120 ms |",
  "---",
  "# Thanks",
].join("\n");

async function exportSample() {
  const { content } = compileDeckMarkdown(MARKDOWN);
  return JSZip.loadAsync(
    await exportDeckToPptx(content, { title: "Launch plan" }),
  );
}

async function text(zip: JSZip, name: string) {
  const file = zip.file(name);
  if (!file) throw new Error(`Missing ${name}`);
  return file.async("string");
}

describe("exportDeckToPptx", () => {
  it("writes one slide per deck slide in a widescreen presentation", async () => {
    const zip = await exportSample();
    const slides = zip.file(/^ppt\/slides\/slide\d+\.xml$/);
    const presentation = await text(zip, "ppt/presentation.xml");

    expect(slides).toHaveLength(4);
    expect(presentation).toContain('cx="12192000" cy="6858000"');
  });

  it("fills layout placeholders so text stays editable in PowerPoint", async () => {
    const zip = await exportSample();
    const highlights = await text(zip, "ppt/slides/slide2.xml");

    expect(highlights).toMatch(/<p:ph[^>]*type="title"/);
    expect(highlights).toContain("Highlights");
    expect(highlights).toContain("Sync shipped");
    expect(highlights).toMatch(/lvl="1"/);
  });

  it("exports tables as native tables and speaker notes as notes", async () => {
    const zip = await exportSample();
    const numbers = await text(zip, "ppt/slides/slide3.xml");
    const notes = await Promise.all(
      zip
        .file(/^ppt\/notesSlides\/notesSlide\d+\.xml$/)
        .map((file) => file.async("string")),
    );

    expect(numbers).toContain("<a:tbl>");
    expect(numbers).toContain("120 ms");
    expect(notes.some((xml) => xml.includes("Lead with latency."))).toBe(true);
  });
});
