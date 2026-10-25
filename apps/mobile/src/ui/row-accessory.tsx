import CheckIcon from "@expo/material-symbols/check.xml";
import ChevronRightIcon from "@expo/material-symbols/chevron_right.xml";
import FolderSymbol from "@expo/material-symbols/folder.xml";
import { Column, Icon, Row, Text } from "@expo/ui";
import { space, useThemeColors } from "@/theme";

export function SelectedMark({ selected }: { selected: boolean }) {
  const colors = useThemeColors();
  if (!selected) return null;
  return (
    <Icon
      name={{ ios: "checkmark", android: CheckIcon }}
      size={18}
      color={colors.tint}
    />
  );
}

export function RowValue({
  value,
  detail,
}: {
  value: string;
  detail?: string | null;
}) {
  const colors = useThemeColors();
  return (
    <Row alignment="center" spacing={space.sm}>
      <Column alignment="end">
        <Text
          numberOfLines={1}
          textStyle={{ color: colors.mutedForeground, fontSize: 17 }}
        >
          {value}
        </Text>
        {detail ? (
          <Text
            numberOfLines={1}
            textStyle={{ color: colors.mutedForeground, fontSize: 13 }}
          >
            {detail}
          </Text>
        ) : null}
      </Column>
      <Icon
        name={{ ios: "chevron.right", android: ChevronRightIcon }}
        size={13}
        color={colors.mutedForeground}
      />
    </Row>
  );
}

export function FolderIcon() {
  const colors = useThemeColors();
  return (
    <Icon
      name={{ ios: "folder", android: FolderSymbol }}
      size={20}
      color={colors.mutedForeground}
    />
  );
}
