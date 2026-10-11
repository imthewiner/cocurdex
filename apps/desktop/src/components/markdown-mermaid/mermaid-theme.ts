import type { MermaidConfig } from "@streamdown/mermaid";

export type MermaidAppearance = "dark" | "light";

const THEME_VARIABLES: Record<
  MermaidAppearance,
  NonNullable<MermaidConfig["themeVariables"]>
> = {
  dark: {
    background: "#0a0a0a",
    clusterBkg: "#11161d",
    clusterBorder: "#2a323d",
    darkMode: true,
    edgeLabelBackground: "#151a21",
    lineColor: "#6e7681",
    primaryBorderColor: "#2c4a72",
    primaryColor: "#14243a",
    primaryTextColor: "#b9d7ff",
    secondaryColor: "#1b2a1f",
    tertiaryColor: "#241c2e",
    textColor: "#c9d1d9",
  },
  light: {
    background: "#ffffff",
    clusterBkg: "#f6f8fa",
    clusterBorder: "#d8dee4",
    darkMode: false,
    edgeLabelBackground: "#ffffff",
    lineColor: "#8c959f",
    primaryBorderColor: "#b6d4fb",
    primaryColor: "#e7f1fd",
    primaryTextColor: "#0b4f9c",
    secondaryColor: "#e9f6ec",
    tertiaryColor: "#f3eefb",
    textColor: "#24292f",
  },
};

const THEME_CSS = [
  ".node rect, .cluster rect { rx: 10px; ry: 10px; }",
  ".edgeLabel, .edgeLabel p { border-radius: 4px; }",
].join("\n");

export function mermaidThemeConfig(
  appearance: MermaidAppearance,
  fontFamily: string,
): MermaidConfig {
  return {
    fontFamily,
    theme: "base",
    themeCSS: THEME_CSS,
    themeVariables: { ...THEME_VARIABLES[appearance], fontFamily },
  };
}
