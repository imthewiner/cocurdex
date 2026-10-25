import type { SearchBarProps } from "react-native-screens";
import { useThemeColors } from "@/theme";

export function useSearchBarOptions(
  placeholder: string,
  onQuery: (query: string) => void,
): SearchBarProps {
  const colors = useThemeColors();
  return {
    placeholder,
    hideWhenScrolling: false,
    headerIconColor: colors.foreground,
    textColor: colors.foreground,
    hintTextColor: colors.mutedForeground,
    tintColor: colors.tint,
    onChangeText: (event) => onQuery(event.nativeEvent.text),
    onCancelButtonPress: () => onQuery(""),
  };
}
