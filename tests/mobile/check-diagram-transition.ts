import assert from "node:assert/strict";
import path from "node:path";
import { runCommand } from "./lib/command";

const video = process.argv[2];
assert(video, "Pass a dark Mermaid fullscreen transition recording");
const backgroundCrop = process.argv[3];
if (backgroundCrop) {
  assert.match(backgroundCrop, /^\d+:\d+:\d+:\d+$/);
  const background = await runCommand("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    path.resolve(video),
    "-vf",
    `crop=${backgroundCrop},signalstats,metadata=print:file=-`,
    "-an",
    "-f",
    "null",
    "-",
  ]);
  const luminance = [
    ...background.matchAll(/lavfi.signalstats.YAVG=([\d.]+)/g),
  ].map((match) => Number(match[1]));
  assert(
    luminance.length > 1,
    "Recording must contain multiple background frames",
  );
  const variation = Math.max(...luminance) - Math.min(...luminance);
  console.log(JSON.stringify({ backgroundCrop, variation }));
  assert(variation <= 3, "Background flashes during fullscreen entry");
}
const metadata = await runCommand("ffmpeg", [
  "-hide_banner",
  "-loglevel",
  "error",
  "-i",
  path.resolve(video),
  "-vf",
  "crop=iw:ih*0.8:0:ih*0.1,blackdetect=d=0.05:pic_th=0.995:pix_th=0.1,metadata=mode=print:file=-",
  "-an",
  "-f",
  "null",
  "-",
]);
const intervals: { start: number; end: number; durationMs: number }[] = [];
let start: number | undefined;
for (const match of metadata.matchAll(/lavfi.black_(start|end)=([\d.]+)/g)) {
  const time = Number(match[2]);
  if (match[1] === "start") {
    start = time;
  } else if (start !== undefined) {
    intervals.push({ start, end: time, durationMs: (time - start) * 1000 });
    start = undefined;
  }
}
console.log(JSON.stringify({ video, intervals }));
assert.equal(start, undefined, "Recording ends on an empty dark frame");
assert.equal(
  intervals.filter(({ durationMs }) => durationMs >= 50).length,
  0,
  "Diagram disappears for at least 50 ms during fullscreen entry",
);
