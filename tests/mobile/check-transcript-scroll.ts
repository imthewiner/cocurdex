import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

interface Node {
  label?: string;
  identifier?: string;
  kind?: string;
  rect: { x: number; y: number; width: number; height: number };
}

async function nodes(file: string | undefined): Promise<Node[]> {
  assert(
    file,
    "Expected initial, filled, paused-before, paused-after, resumed snapshots",
  );
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

const [initial, filled, pausedBefore, pausedAfter, resumed] = await Promise.all(
  Array.from({ length: 5 }, (_, index) => nodes(process.argv[index + 2])),
);
assert(initial && filled && pausedBefore && pausedAfter && resumed);
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
assert(
  lastSection(filled) > lastSection(initial),
  "Filling the viewport must advance the visible tail",
);
assert.deepEqual(
  sections(pausedBefore).map(({ label, rect }) => ({ label, rect })),
  sections(pausedAfter).map(({ label, rect }) => ({ label, rect })),
  "Incoming text must not move the viewport after a manual scroll",
);
assert(
  lastSection(resumed) > lastSection(pausedAfter),
  "Jump to latest must resume following",
);
process.stdout.write(
  `${JSON.stringify({ promptY: prompt.rect.y, initialSection: lastSection(initial), filledSection: lastSection(filled), resumedSection: lastSection(resumed), pausedPositionStable: true })}\n`,
);
