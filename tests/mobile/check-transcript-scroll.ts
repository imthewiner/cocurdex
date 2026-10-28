import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

interface Node {
  label?: string;
  identifier?: string;
  kind?: string;
  rect: { x: number; y: number; width: number; height: number };
}

async function nodes(file: string | undefined): Promise<Node[]> {
  assert(file, "Expected initial, filled, jumped, after-jump snapshots");
  const snapshot = JSON.parse(await readFile(file, "utf8"));
  assert(snapshot.success, `Snapshot failed: ${file}`);
  return snapshot.data.nodes;
}

function sections(snapshot: Node[]) {
  return snapshot.filter((node) => /^Section \d+$/.test(node.label ?? ""));
}

function lastSection(snapshot: Node[]) {
  const values = sections(snapshot).map((node) => Number(node.label?.slice(8)));
  assert(values.length > 0, "Expected visible numbered sections");
  return Math.max(...values);
}

const [initial, filled, jumped, afterJump] = await Promise.all(
  Array.from({ length: 4 }, (_, index) => nodes(process.argv[index + 2])),
);
assert(initial && filled && jumped && afterJump);
assert(
  !initial.some((node) => node.label === "跳到最新消息"),
  "Anchor space must not show a latest-message button before content fills the viewport",
);
assert(
  filled.some((node) => node.label === "跳到最新消息"),
  "Content beyond the viewport must show the latest-message button",
);
const prompt = initial.find((node) =>
  node.identifier?.startsWith("transcript-user-"),
);
assert(
  prompt,
  "Sent prompt must remain visible before the response fills the screen",
);
const viewport = initial.filter((node) => node.kind === "scroll-area").at(-1);
assert(viewport, "Expected transcript viewport");
assert(
  prompt.rect.y - viewport.rect.y < viewport.rect.height * 0.1,
  "Sent prompt must start near the top",
);
const filledPrompt = filled.find(
  (node) => node.identifier === prompt.identifier,
);
assert(filledPrompt, "Stream growth must leave the sent prompt visible");
assert.deepEqual(
  filledPrompt.rect,
  prompt.rect,
  "Crossing the viewport boundary must preserve the prompt position",
);
for (const section of sections(initial)) {
  const current = sections(filled).find((node) => node.label === section.label);
  assert.deepEqual(
    current?.rect,
    section.rect,
    "Streaming must preserve existing section positions",
  );
}
assert(
  lastSection(jumped) > lastSection(filled),
  "Explicit jump must reveal newer content",
);
assert.deepEqual(
  sections(jumped).map(({ label, rect }) => ({ label, rect })),
  sections(afterJump).map(({ label, rect }) => ({ label, rect })),
  "Incoming text must not move the viewport after a manual jump",
);
process.stdout.write(
  `${JSON.stringify({ promptY: prompt.rect.y, filledSection: lastSection(filled), jumpedSection: lastSection(jumped), positionStable: true })}\n`,
);
