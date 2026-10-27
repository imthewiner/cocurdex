import CheckIcon from "@expo/material-symbols/check.xml";
import {
  BottomSheet,
  Column,
  Icon,
  type IconName,
  ScrollView,
  Text,
  TextInput,
} from "@expo/ui";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import { space, useThemeColors } from "@/theme";
import { matchesQuery } from "./option-query";
import { SheetRow } from "./sheet-row";

const TITLE_INSET = Platform.OS === "android" ? 16 : 0;

export interface ListSheetItem {
  key: string;
  label: string;
  supporting?: string;
  icon?: IconName;
  destructive?: boolean;
  selected?: boolean;
  testID?: string;
  onPress(): void;
}

export function ListSheet({
  presented,
  title,
  subtitle,
  items,
  footer,
  onDismiss,
  testID,
  scrollable = false,
  searchable = false,
}: {
  presented: boolean;
  title: string;
  subtitle?: string | null;
  items: readonly ListSheetItem[];
  footer?: ReactNode;
  onDismiss(): void;
  testID?: string;
  scrollable?: boolean;
  searchable?: boolean;
}) {
  const { t } = useTranslation("common");
  const colors = useThemeColors();
  const [query, setQuery] = useState("");
  const dismiss = () => {
    setQuery("");
    onDismiss();
  };
  const shown = searchable
    ? items.filter((item) => matchesQuery(item, query))
    : items;
  const rows = shown.map((item) => {
    const color = item.destructive ? colors.destructive : colors.foreground;
    const iconColor = item.destructive
      ? colors.destructive
      : colors.mutedForeground;
    return (
      <SheetRow
        key={item.key}
        testID={item.testID}
        label={item.label}
        supporting={item.supporting}
        color={color}
        onPress={item.onPress}
        leading={
          item.icon ? (
            <Icon name={item.icon} size={22} color={iconColor} />
          ) : undefined
        }
        trailing={
          item.selected ? (
            <Icon
              name={{ ios: "checkmark", android: CheckIcon }}
              size={18}
              color={colors.tint}
            />
          ) : undefined
        }
      />
    );
  });
  return (
    <BottomSheet
      isPresented={presented}
      onDismiss={dismiss}
      containerColor={colors.popover}
      testID={testID}
      snapPoints={scrollable ? ["half", "full"] : undefined}
    >
      <Column spacing={space.xs}>
        <Column spacing={2} style={{ paddingHorizontal: TITLE_INSET }}>
          <Text
            numberOfLines={2}
            textStyle={{
              color: colors.foreground,
              fontSize: 17,
              fontWeight: "600",
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={2}
              textStyle={{ color: colors.mutedForeground, fontSize: 13 }}
            >
              {subtitle}
            </Text>
          ) : null}
        </Column>
        {searchable ? (
          <Column style={{ paddingHorizontal: TITLE_INSET }}>
            <TextInput
              testID={testID ? `${testID}-search` : "list-sheet-search"}
              placeholder={t("optionSearch.placeholder")}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onChangeText={setQuery}
              placeholderTextColor={colors.mutedForeground}
              cursorColor={colors.tint}
              style={{
                backgroundColor: colors.muted,
                borderRadius: 10,
                paddingHorizontal: space.md,
                paddingVertical: space.sm,
              }}
            />
          </Column>
        ) : null}
        {searchable && shown.length === 0 ? (
          <Text
            textStyle={{ color: colors.mutedForeground, fontSize: 15 }}
            style={{
              paddingHorizontal: TITLE_INSET,
              paddingVertical: space.md,
            }}
          >
            {t("optionSearch.empty")}
          </Text>
        ) : null}
        {scrollable ? (
          <ScrollView>
            <Column spacing={space.xs}>{rows}</Column>
          </ScrollView>
        ) : (
          rows
        )}
        {footer}
      </Column>
    </BottomSheet>
  );
}
