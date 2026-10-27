import { StyleSheet, Text, View } from "react-native";
import { layout, space, useThemeColors } from "@/theme";
import type { ListHeader, ListSearch } from "./list-header-props";
import { useSearchBarOptions } from "./use-search-bar-options";

const IGNORE_QUERY = () => undefined;

function LargeListHeader({ title }: { title: string }) {
  const colors = useThemeColors();
  return (
    <View style={styles.header}>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: colors.foreground }]}
      >
        {title}
      </Text>
    </View>
  );
}

export function useListHeader(title: string, search?: ListSearch): ListHeader {
  const searchBarOptions = useSearchBarOptions(
    search?.placeholder ?? "",
    search?.onQuery ?? IGNORE_QUERY,
  );
  return {
    options: {
      title: "",
      headerShadowVisible: false,
      ...(search ? { headerSearchBarOptions: searchBarOptions } : {}),
    },
    header: <LargeListHeader title={title} />,
  };
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: layout.sideMargin,
    paddingTop: space.xs,
    paddingBottom: space.md,
  },
  title: { fontSize: 28, lineHeight: 36 },
});
