import CheckIcon from "@expo/material-symbols/check.xml";
import { BottomSheet, Column, Icon, type IconName, Text } from "@expo/ui";
import type { ReactNode } from "react";
import { Platform } from "react-native";
import { space, useThemeColors } from "@/theme";
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
}: {
  presented: boolean;
  title: string;
  subtitle?: string | null;
  items: readonly ListSheetItem[];
  footer?: ReactNode;
  onDismiss(): void;
  testID?: string;
}) {
  const colors = useThemeColors();
  return (
    <BottomSheet
      isPresented={presented}
      onDismiss={onDismiss}
      containerColor={colors.popover}
      testID={testID}
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
              numberOfLines={1}
              textStyle={{ color: colors.mutedForeground, fontSize: 13 }}
            >
              {subtitle}
            </Text>
          ) : null}
        </Column>
        {items.map((item) => {
          const color = item.destructive
            ? colors.destructive
            : colors.foreground;
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
        })}
        {footer}
      </Column>
    </BottomSheet>
  );
}
