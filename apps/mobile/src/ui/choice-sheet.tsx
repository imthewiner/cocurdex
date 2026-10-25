import CheckIcon from "@expo/material-symbols/check.xml";
import { BottomSheet, Column, Icon, ListItem, Text } from "@expo/ui";
import { Platform } from "react-native";
import { space, useThemeColors } from "@/theme";

const TRANSPARENT = "#00000000";
const LIST_ITEM_INSET = Platform.OS === "android" ? 16 : 0;

export const SHEET_TITLE_INSET = LIST_ITEM_INSET;

export interface Choice {
  value: string;
  label: string;
}

export function ChoiceSheet({
  title,
  choices,
  selected,
  onSelect,
  onDismiss,
  testID,
}: {
  title: string | null;
  choices: readonly Choice[];
  selected: string | null;
  onSelect(value: string): void;
  onDismiss(): void;
  testID?: string;
}) {
  const colors = useThemeColors();
  return (
    <BottomSheet
      isPresented={title !== null}
      onDismiss={onDismiss}
      containerColor={colors.background}
      testID={testID}
    >
      {title !== null ? (
        <Column spacing={space.xs}>
          <Column style={{ paddingHorizontal: LIST_ITEM_INSET }}>
            <Text
              textStyle={{
                color: colors.foreground,
                fontSize: 17,
                fontWeight: "600",
              }}
            >
              {title}
            </Text>
          </Column>
          {choices.map((choice) => (
            <ListItem
              key={choice.value}
              colors={{ containerColor: TRANSPARENT }}
              onPress={() => {
                onSelect(choice.value);
                onDismiss();
              }}
              trailing={
                choice.value === selected ? (
                  <Icon
                    name={{ ios: "checkmark", android: CheckIcon }}
                    size={18}
                    color={colors.tint}
                  />
                ) : undefined
              }
            >
              <Text textStyle={{ color: colors.foreground }}>
                {choice.label}
              </Text>
            </ListItem>
          ))}
        </Column>
      ) : null}
    </BottomSheet>
  );
}
