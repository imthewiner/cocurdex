import { readFile } from "node:fs/promises";
import path from "node:path";
import { requestDaemon } from "@cocurdex/daemon/client";
import { buildDaemonDeckDownloadUrl } from "@cocurdex/shared";
import { createTempDirs } from "@cocurdex/shared/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCli } from "./helpers/cli";
import { type DaemonProcess, spawnDaemon } from "./helpers/daemon-process";

const tempDirs = createTempDirs();
afterAll(() => tempDirs.cleanup());

const ZIP_SIGNATURE = Buffer.from("PK\u0003\u0004", "latin1");

const MARKDOWN = [
  "# Acme roadmap",
  "Synthetic deck",
  "---",
  "## Highlights",
  "- Faster checkout",
  "",
  "Notes: Mention the latency win.",
  "---",
  "# Thanks",
].join("\n");

interface DeckJson {
  id: string;
  title: string;
  slideCount: number;
  revision: number;
}

interface WriteJson {
  deck: DeckJson;
  warnings: unknown[];
  issues: unknown[];
}

describe("decks through the CLI and daemon", () => {
  let daemon: DaemonProcess;

  beforeAll(async () => {
    daemon = await spawnDaemon();
  });

  afterAll(async () => {
    await daemon.dispose();
  });

  it("creates a deck from Markdown, rejects stale writes, and exports a file", async () => {
    const options = { userDataPath: daemon.userDataPath };
    const created = await runCli(
      ["deck", "create", "--markdown-file", "-", "--json"],
      { ...options, input: MARKDOWN },
    );
    expect(created.stderr).toBe("");
    const result = JSON.parse(created.stdout) as WriteJson;
    expect(result.deck).toMatchObject({
      title: "Acme roadmap",
      slideCount: 3,
      revision: 1,
    });
    expect(result.issues).toEqual([]);
    expect(result.warnings).toEqual([]);

    const renamed = await runCli(
      [
        "deck",
        "update",
        result.deck.id,
        "--title",
        "Acme plan",
        "--expected-revision",
        "1",
        "--json",
      ],
      options,
    );
    expect(renamed.code).toBe(0);
    const stale = await runCli(
      [
        "deck",
        "update",
        result.deck.id,
        "--title",
        "Lost",
        "--expected-revision",
        "1",
        "--json",
      ],
      options,
    );
    expect(stale.code).not.toBe(0);
    expect(stale.stderr).toContain("Deck was modified");

    const shown = await runCli(
      ["deck", "show", result.deck.id, "--json"],
      options,
    );
    expect(JSON.parse(shown.stdout)).toMatchObject({
      title: "Acme plan",
      revision: 2,
      issues: [],
    });

    const outputPath = path.join(
      tempDirs.createSync("cocu-deck-"),
      "out",
      "plan.pptx",
    );
    const exported = await runCli(
      ["deck", "export", result.deck.id, "--output", outputPath, "--json"],
      options,
    );
    expect(exported.stderr).toBe("");
    const bytes = await readFile(outputPath);
    expect(JSON.parse(exported.stdout)).toEqual({
      outputPath,
      sizeBytes: bytes.byteLength,
    });
    expect(bytes.subarray(0, 4)).toEqual(ZIP_SIGNATURE);

    const pdfPath = path.join(path.dirname(outputPath), "plan.pdf");
    const pdf = await runCli(
      ["deck", "export", result.deck.id, "--output", pdfPath, "--json"],
      options,
    );
    expect(pdf.stderr).toBe("");
    const pdfBytes = await readFile(pdfPath);
    expect(JSON.parse(pdf.stdout)).toEqual({
      outputPath: pdfPath,
      sizeBytes: pdfBytes.byteLength,
    });
    expect(pdfBytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("edits slides with ops and reports the ids an agent targets", async () => {
    const options = { userDataPath: daemon.userDataPath };
    const created = JSON.parse(
      (
        await runCli(["deck", "create", "--markdown-file", "-", "--json"], {
          ...options,
          input: MARKDOWN,
        })
      ).stdout,
    ) as WriteJson;
    const id = created.deck.id;
    const before = JSON.parse(
      (await runCli(["deck", "show", id, "--json"], options)).stdout,
    ) as { content: { slides: { id: string }[] } };
    const [cover, highlights] = before.content.slides;
    const ops = [
      { op: "setTheme", theme: "midnight" },
      { op: "duplicateSlide", slideId: highlights?.id },
      {
        op: "setText",
        slideId: cover?.id,
        target: "slot:title",
        markdown: "Acme **2027**",
      },
      { op: "setLayout", slideId: highlights?.id, layout: "two-content" },
      { op: "moveSlide", slideId: cover?.id, index: 99 },
    ];
    const edited = await runCli(
      ["deck", "edit", id, "--ops-file", "-", "--expected-revision", "1"],
      { ...options, input: JSON.stringify(ops) },
    );
    expect(edited.stderr).toBe("");
    const shown = JSON.parse(
      (await runCli(["deck", "show", id, "--json"], options)).stdout,
    ) as {
      revision: number;
      content: {
        theme: string;
        slides: { id: string; layout: string; slots: object }[];
      };
    };
    expect(shown.revision).toBe(2);
    expect(shown.content.theme).toBe("midnight");
    expect(shown.content.slides.map((slide) => slide.layout)).toEqual([
      "two-content",
      "title-content",
      "closing",
      "cover",
    ]);
    expect(shown.content.slides[3]?.slots).toMatchObject({
      title: {
        paragraphs: [
          { runs: [{ text: "Acme " }, { text: "2027", bold: true }] },
        ],
      },
    });

    const stale = await runCli(
      ["deck", "edit", id, "--ops-file", "-", "--expected-revision", "1"],
      {
        ...options,
        input: JSON.stringify([{ op: "deleteSlide", slideId: cover?.id }]),
      },
    );
    expect(stale.code).not.toBe(0);
    expect(stale.stderr).toContain("Deck was modified");

    const invalid = await runCli(["deck", "edit", id, "--ops-file", "-"], {
      ...options,
      input: JSON.stringify([{ op: "deleteSlide", slideId: "missing" }]),
    });
    expect(invalid.code).not.toBe(0);
    expect(invalid.stderr).toContain("Slide not found: missing");
  });

  it("serves a deck download once per ticket without a bearer header", async () => {
    const { deck } = await requestDaemon(
      "deck.create",
      { title: "Acme / Q4: plan", markdown: MARKDOWN },
      daemon.options,
    );
    const download = await requestDaemon(
      "deck.createDownload",
      { id: deck.id, format: "pptx" },
      daemon.options,
    );
    expect(download.fileName).toBe("Acme Q4 plan.pptx");
    const url = buildDaemonDeckDownloadUrl(
      daemon.metadata.webSocketUrl,
      download,
    );

    const first = await fetch(url);
    expect(first.status).toBe(200);
    expect(first.headers.get("content-type")).toContain("presentationml");
    expect(first.headers.get("content-disposition")).toContain(
      "filename*=UTF-8''Acme%20Q4%20plan.pptx",
    );
    const body = Buffer.from(await first.arrayBuffer());
    expect(body.subarray(0, 4)).toEqual(ZIP_SIGNATURE);

    const replay = await fetch(url);
    expect(replay.status).toBe(404);
  });
});
