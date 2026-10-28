import argparse
import statistics
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument("video")
parser.add_argument("--start", type=float, required=True)
parser.add_argument("--duration", type=float, required=True)
parser.add_argument("--crop", required=True)
args = parser.parse_args()
result = subprocess.run([
    "ffmpeg", "-loglevel", "error", "-ss", str(args.start), "-i", args.video,
    "-t", str(args.duration), "-vf", f"fps=30,crop={args.crop},scale=120:20",
    "-pix_fmt", "gray", "-f", "rawvideo", "pipe:1",
], check=True, capture_output=True)
size = 120 * 20
frames = [result.stdout[i:i + size] for i in range(0, len(result.stdout), size)]
assert len(frames) >= 30, "Expected at least one second of keyboard transitions"
reference = [statistics.median(values) for values in zip(*frames)]
changes = [sum(abs(value - expected) > 24 for value, expected in zip(frame, reference)) / size for frame in frames]
worst = max(changes)
assert worst < 0.05, f"Anchored prompt flashed or shifted: {worst:.1%} of pixels changed"
print({"frames": len(frames), "maximum_changed_fraction": worst})
