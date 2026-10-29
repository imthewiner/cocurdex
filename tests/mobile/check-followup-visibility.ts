import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [file, text] = process.argv.slice(2);
assert(file && text, "Expected snapshot path and sent prompt");
const snapshot = JSON.parse(await readFile(file, "utf8"));
assert(snapshot.success, "Snapshot failed");
interface Node {
  label?: string;
  kind?: string;
  rect: { x: number; y: number; width: number; height: number };
}
const nodes: Node[] = snapshot.data.nodes;
const prompt = nodes.find((node) => node.label === text);
const viewport = nodes.filter((node) => node.kind === "scroll-area").at(-1);
assert(viewport, "Expected transcript viewport");
assert(
  prompt,
  "Newly sent follow-up must be visible while the keyboard is open",
);
assert(
  prompt.rect.y >= viewport.rect.y,
  "Follow-up must not be clipped above the viewport",
);
assert(
  prompt.rect.y + prompt.rect.height <= viewport.rect.y + viewport.rect.height,
  "Follow-up must remain above the composer and keyboard",
);
assert(
  prompt.rect.y - viewport.rect.y < viewport.rect.height * 0.1,
  "Follow-up must be anchored near the top",
);
process.stdout.write(
  `${JSON.stringify({ prompt: prompt.rect, viewport: viewport.rect })}\n`,
);
