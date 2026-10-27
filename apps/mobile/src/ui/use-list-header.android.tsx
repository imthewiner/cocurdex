import SearchIcon from "@expo/material-symbols/search.xml";
import {
  Text as ComposeText,
  DockedSearchBar,
  Icon,
} from "@expo/ui/jetpack-compose";
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers";
import { StyleSheet, Text, View } from "react-native";
import { layout, space, useThemeColors } from "@/theme";
import { BrandHost } from "./brand-host";
import type { ListHeader, ListSearch } from "./list-header-props";

function LargeListHeader({
  title,
  search,
}: {
  title: string;
  search?: ListSearch;
}) {
  const colors = useThemeColors();
  return (
    <View style={styles.header}>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: colors.foreground }]}
      >
        {title}
      </Text>
      {search ? (
        <BrandHost matchContents={{ vertical: true }}>
          <DockedSearchBar
            onQueryChange={search.onQuery}
            modifiers={[fillMaxWidth()]}
          >
            <DockedSearchBar.Placeholder>
              <ComposeText color={colors.mutedForeground}>
                {search.placeholder}
              </ComposeText>
            </DockedSearchBar.Placeholder>
            <DockedSearchBar.LeadingIcon>
              <Icon
                source={SearchIcon}
                tint={colors.mutedForeground}
                size={24}
              />
            </DockedSearchBar.LeadingIcon>
          </DockedSearchBar>
        </BrandHost>
      ) : null}
    </View>
  );
}

export function useListHeader(title: string, search?: ListSearch): ListHeader {
  return {
    options: { title: "", headerShadowVisible: false },
    header: <LargeListHeader title={title} search={search} />,
  };
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: layout.sideMargin,
    paddingTop: space.xs,
    paddingBottom: space.md,
    gap: space.md,
  },
  title: { fontSize: 28, lineHeight: 36 },
});
