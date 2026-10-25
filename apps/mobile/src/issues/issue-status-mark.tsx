import type { IssueStatusCategory } from "@cocurdex/shared";
import CancelIcon from "@expo/material-symbols/cancel.xml";
import CheckCircleIcon from "@expo/material-symbols/check_circle.xml";
import ContrastIcon from "@expo/material-symbols/contrast.xml";
import PendingIcon from "@expo/material-symbols/pending.xml";
import UncheckedIcon from "@expo/material-symbols/radio_button_unchecked.xml";
import { Icon } from "@expo/ui";
import { SymbolView } from "expo-symbols";
import type { ImageSourcePropType } from "react-native";
import { type ThemeColors, useThemeColors } from "@/theme";

type Glyph = {
  name: { ios: string; android: string };
  drawable: ImageSourcePropType;
  color: keyof ThemeColors;
};

const GLYPHS = {
  backlog: {
    name: { ios: "circle.dashed", android: "pending" },
    drawable: PendingIcon,
    color: "mutedForeground",
  },
  unstarted: {
    name: { ios: "circle", android: "radio_button_unchecked" },
    drawable: UncheckedIcon,
    color: "mutedForeground",
  },
  started: {
    name: { ios: "circle.lefthalf.filled", android: "contrast" },
    drawable: ContrastIcon,
    color: "statusWarning",
  },
  completed: {
    name: { ios: "checkmark.circle.fill", android: "check_circle" },
    drawable: CheckCircleIcon,
    color: "brandMark",
  },
  canceled: {
    name: { ios: "xmark.circle", android: "cancel" },
    drawable: CancelIcon,
    color: "mutedForeground",
  },
  none: {
    name: { ios: "circle", android: "radio_button_unchecked" },
    drawable: UncheckedIcon,
    color: "mutedForeground",
  },
} as const satisfies Record<IssueStatusCategory | "none", Glyph>;

export function IssueStatusMark({
  category,
  label,
}: {
  category: IssueStatusCategory | null;
  label: string;
}) {
  const colors = useThemeColors();
  const glyph = GLYPHS[category ?? "none"];
  return (
    <SymbolView
      accessibilityLabel={label}
      name={glyph.name}
      size={18}
      tintColor={colors[glyph.color]}
    />
  );
}

export function IssueStatusIcon({
  category,
  label,
}: {
  category: IssueStatusCategory | null;
  label: string;
}) {
  const colors = useThemeColors();
  const glyph = GLYPHS[category ?? "none"];
  return (
    <Icon
      accessibilityLabel={label}
      name={{ ios: glyph.name.ios, android: glyph.drawable }}
      size={18}
      color={colors[glyph.color]}
    />
  );
}
