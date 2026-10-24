import { Host } from "@expo/ui";
import { useThemeColors } from "@/theme";
import type { BrandHostProps } from "./brand-host-props";

export function BrandHost(props: BrandHostProps) {
  const colors = useThemeColors();
  return <Host {...props} seedColor={colors.primary} />;
}
