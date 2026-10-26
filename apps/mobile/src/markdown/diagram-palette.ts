import type { MermaidAppearance } from "@cocurdex/shared";
import { themeColors } from "@/theme";
import type { DiagramPalette } from "./native-mermaid";

export function diagramPalette(appearance: MermaidAppearance): DiagramPalette {
  const { background, foreground } = themeColors[appearance];
  return { background, foreground };
}
