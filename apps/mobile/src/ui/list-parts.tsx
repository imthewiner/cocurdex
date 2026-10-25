import { Button, Column, Text as UiText } from "@expo/ui";
import { StyleSheet, Text, View } from "react-native";
import { layout, space, useThemeColors } from "@/theme";
import { BrandHost } from "./brand-host";

export function ListNotice({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { label: string; onPress(): void };
}) {
  const colors = useThemeColors();
  return (
    <View style={styles.notice}>
      <BrandHost matchContents={{ vertical: true }}>
        <Column alignment="center" spacing={space.md}>
          <UiText textStyle={{ fontWeight: "600" }}>{title}</UiText>
          {description ? (
            <UiText
              textStyle={{ color: colors.mutedForeground, textAlign: "center" }}
            >
              {description}
            </UiText>
          ) : null}
          {action ? (
            <Button label={action.label} onPress={action.onPress} />
          ) : null}
        </Column>
      </BrandHost>
    </View>
  );
}

export function ListSeparator() {
  const colors = useThemeColors();
  return (
    <View style={[styles.separator, { backgroundColor: colors.border }]} />
  );
}

export function ListSectionHeader({ title }: { title: string }) {
  const colors = useThemeColors();
  return (
    <Text
      accessibilityRole="header"
      style={[styles.sectionTitle, { color: colors.foreground }]}
    >
      {title}
    </Text>
  );
}

const styles = StyleSheet.create({
  notice: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: layout.sideMargin,
    paddingVertical: space.xxl,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: layout.sideMargin,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    paddingHorizontal: layout.sideMargin,
    paddingTop: space.lg,
    paddingBottom: space.xs,
  },
});
