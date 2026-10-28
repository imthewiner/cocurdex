import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

interface SnapshotNode {
  identifier?: string;
  kind?: string;
  label?: string;
  rect: { x: number; y: number; width: number; height: number };
}

const files = process.argv.slice(2);
assert(files.length > 0, "Expected device snapshot files");
for (const file of files) {
  const snapshot = JSON.parse(await readFile(file, "utf8"));
  assert(snapshot.success, `Snapshot failed: ${file}`);
  const nodes: SnapshotNode[] = snapshot.data.nodes;
  const button = nodes.find((node) => node.identifier === "transcript-jump");
  const viewport = nodes.filter((node) => node.kind === "scroll-area").at(-1);
  assert(button && viewport, "Expected jump control and transcript viewport");
  const scale = button.rect.width / 40;
  const rightGap =
    (viewport.rect.x +
      viewport.rect.width -
      button.rect.x -
      button.rect.width) /
    scale;
  const bottomGap =
    (viewport.rect.y +
      viewport.rect.height -
      button.rect.y -
      button.rect.height) /
    scale;
  assert(
    Math.abs(rightGap - 16) <= 1,
    `Expected 16dp right inset: ${rightGap}`,
  );
  assert(
    Math.abs(bottomGap - 16) <= 1,
    `Expected 16dp bottom inset: ${bottomGap}`,
  );
  process.stdout.write(
    `${JSON.stringify({ file, label: button.label, rightGap, bottomGap })}\n`,
  );
}
