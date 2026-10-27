import { type AndroidSymbol, type SFSymbol, SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, View } from "react-native";
import { type ThemeColors, useThemeColors } from "@/theme";

const SIZE = 44;

function iconColor(
  colors: ThemeColors,
  { filled, prominent }: { filled: boolean; prominent: boolean },
) {
  if (filled) return colors.background;
  if (prominent) return colors.mutedForeground;
  return colors.foreground;
}

export function CircleButton({
  icon,
  label,
  onPress,
  badge = false,
  disabled = false,
  prominent = false,
  tonal = false,
  testID,
}: {
  icon: { ios: SFSymbol; android: AndroidSymbol };
  label: string;
  onPress(): void;
  badge?: boolean;
  disabled?: boolean;
  prominent?: boolean;
  tonal?: boolean;
  testID?: string;
}) {
  const colors = useThemeColors();
  const filled = prominent && !disabled;
  const tint = iconColor(colors, { filled, prominent });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: colors.muted, borderless: true }}
      style={({ pressed }) => [
        styles.button,
        (tonal || prominent) && { backgroundColor: colors.muted },
        filled && { backgroundColor: colors.foreground },
        pressed && !filled && { opacity: 0.7 },
        disabled && !prominent && styles.disabled,
      ]}
      testID={testID}
    >
      <SymbolView name={icon} size={22} tintColor={tint} />
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.tint }]} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.4 },
  badge: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
