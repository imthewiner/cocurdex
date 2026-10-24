import { useColorScheme } from "react-native";
import generated from "./colors.generated.json";

export type ThemeName = keyof typeof generated;
export type ThemeColors = (typeof generated)[ThemeName];

export const themeColors: Record<ThemeName, ThemeColors> = generated;

export function useThemeColors(): ThemeColors {
  return themeColors[useColorScheme() === "dark" ? "dark" : "light"];
}
