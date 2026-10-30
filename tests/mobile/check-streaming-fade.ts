import assert from "node:assert/strict";
import path from "node:path";
import { spawnCommand } from "@cocurdex/agent-adapters";

const [video, crop, start, duration, theme = "dark"] = process.argv.slice(2);
assert(
  video && crop && start && duration,
  "Pass video, glyph crop, start, and duration",
);
assert.match(crop, /^\d+:\d+:\d+:\d+$/);
assert(Number.isFinite(Number(start)) && Number(start) >= 0);
assert(Number.isFinite(Number(duration)) && Number(duration) > 0);
assert(theme === "dark" || theme === "light");
const [width, height] = crop.split(":").map(Number);
assert(width && height);
const frameSize = width * height;
const samples: number[] = [];
const child = spawnCommand(
  "ffmpeg",
  [
    "-v",
    "error",
    "-ss",
    start,
    "-t",
    duration,
    "-i",
    path.resolve(video),
    "-vf",
    `fps=60,crop=${crop},format=gray${theme === "light" ? ",negate" : ""}`,
    "-f",
    "rawvideo",
    "-",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let pending = Buffer.alloc(0);
let error = "";
child.stderr?.on("data", (chunk: Buffer) => {
  error += chunk.toString();
});
child.stdout?.on("data", (chunk: Buffer) => {
  pending = Buffer.concat([pending, chunk]);
  while (pending.length >= frameSize) {
    const frame = Uint8Array.from(pending.subarray(0, frameSize)).sort();
    const brightest = frame.slice(-Math.min(15, frameSize));
    samples.push(
      brightest.reduce((sum, value) => sum + value, 0) / brightest.length,
    );
    pending = pending.subarray(frameSize);
  }
});
const code = await new Promise<number | null>((resolve, reject) => {
  child.once("error", reject);
  child.once("close", resolve);
});
assert.equal(code, 0, error);
assert(samples.length > 10, "Recording window is too short");
const low = Math.min(...samples);
const high = Math.max(...samples);
assert(
  high - low > 100,
  "Crop must contain a glyph appearing during this window",
);
const normalized = samples.map((value) => (value - low) / (high - low));
const first = normalized.findIndex((value) => value >= 0.1);
const full = normalized.findIndex(
  (value, index) => index >= first && value >= 0.9,
);
assert(first >= 0 && full > first, "Text jumps directly to full opacity");
const fadeMs = ((full - first) / 60) * 1000;
const partialLevels = new Set(
  normalized.slice(first, full).map((value) => Math.round(value * 100)),
).size;
const maxDrop = Math.max(
  0,
  ...normalized
    .slice(first + 1, full + 1)
    .map((value, index) => (normalized[first + index] ?? value) - value),
);
console.log(JSON.stringify({ video, crop, fadeMs, partialLevels, maxDrop }));
assert(fadeMs >= 150, "Completion interrupts the tail fade");
assert(partialLevels >= 4, "Tail fade lacks intermediate opacity levels");
assert(maxDrop <= 0.15, "Existing glyph opacity jumps backwards");
