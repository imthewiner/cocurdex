import { renderMermaidSVG } from "beautiful-mermaid";
import type { RenderedOutput } from "./mermaid-renderer";

export type DiagramPalette = { background: string; foreground: string };

const NATIVE_HEADER =
  /^(?:graph|flowchart|sequenceDiagram|stateDiagram(?:-v2)?|classDiagram|erDiagram)\b/;

const DERIVED_SHARES: Record<string, number> = {
  "--_text-sec": 60,
  "--_text-muted": 40,
  "--_text-faint": 25,
  "--_line": 50,
  "--_arrow": 85,
  "--_node-fill": 3,
  "--_node-stroke": 20,
  "--_group-hdr": 5,
  "--_inner-stroke": 12,
  "--_key-badge": 10,
};

export function rendersNatively(source: string) {
  const header = source
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return header !== undefined && NATIVE_HEADER.test(header);
}

function channels(hex: string) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) =>
    Number.parseInt(value.slice(offset, offset + 2), 16),
  );
}

function mixColors(foreground: string, background: string, percent: number) {
  const front = channels(foreground);
  const back = channels(background);
  return `#${front
    .map((channel, index) =>
      Math.round((channel * percent + back[index] * (100 - percent)) / 100)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

export function diagramColors({ background, foreground }: DiagramPalette) {
  const colors: Record<string, string> = {
    "--bg": background,
    "--fg": foreground,
    "--_text": foreground,
    "--_group-fill": background,
  };
  for (const [name, share] of Object.entries(DERIVED_SHARES)) {
    colors[name] = mixColors(foreground, background, share);
  }
  return colors;
}

export function inlineDiagramColors(
  svg: string,
  colors: Record<string, string>,
  monoFont: string,
) {
  return svg
    .replace(/<style>[\s\S]*?<\/style>/g, "")
    .replace(/ style="--bg:[^"]*"/, "")
    .replace(
      /var\((--[\w-]+)\)/g,
      (match, name: string) => colors[name] ?? match,
    )
    .replace(
      /class="([^"]*\bmono\b[^"]*)"/g,
      `class="$1" font-family="${monoFont}"`,
    );
}

function viewBoxSize(svg: string) {
  const box = svg.match(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/);
  const width = Number(box?.[1]);
  const height = Number(box?.[2]);
  return width > 0 && height > 0 ? { width, height } : null;
}

export function renderNativeDiagram(
  source: string,
  palette: DiagramPalette,
  monoFont: string,
): RenderedOutput | null {
  if (!rendersNatively(source)) return null;
  let rendered: string;
  try {
    rendered = renderMermaidSVG(source, {
      bg: palette.background,
      fg: palette.foreground,
      transparent: true,
    });
  } catch {
    return null;
  }
  const svg = inlineDiagramColors(rendered, diagramColors(palette), monoFont);
  const size = viewBoxSize(svg);
  if (!size || svg.includes("var(")) return null;
  return { svg, ...size, png: null };
}
