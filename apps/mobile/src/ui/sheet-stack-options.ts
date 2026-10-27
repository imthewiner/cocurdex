import { Platform } from "react-native";
import { useGroupedColors, useThemeColors } from "@/theme";

const PUSH_ANIMATION =
  Platform.OS === "android" ? "slide_from_right" : "default";

export function useSheetStackOptions() {
  const colors = useThemeColors();
  const grouped = useGroupedColors();
  return {
    headerBackButtonDisplayMode: "minimal",
    headerTitleAlign: "center",
    headerTintColor: colors.foreground,
    animation: PUSH_ANIMATION,
    headerStyle: { backgroundColor: grouped.page },
    contentStyle: { backgroundColor: grouped.page },
  } as const;
}
