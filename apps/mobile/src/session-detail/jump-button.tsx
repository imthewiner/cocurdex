import type { JumpButtonKind } from "@cocurdex/shared";
import { SymbolView } from "expo-symbols";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { space, useThemeColors } from "@/theme";

const SIZE = 40;
const DOT = 10;

export function JumpButton({
  target,
  unseen,
  onPress,
}: {
  target: Exclude<JumpButtonKind, null>;
  unseen: boolean;
  onPress(): void;
}) {
  const { t } = useTranslation("sessions");
  const colors = useThemeColors();
  const latest = target === "latest";
  return (
    <View pointerEvents="box-none" style={styles.slot}>
      <Pressable
        testID="transcript-jump"
        accessibilityRole="button"
        accessibilityLabel={
          latest ? t("detail.jumpToLatest") : t("detail.jumpToOldest")
        }
        hitSlop={space.xs}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: colors.popover,
            borderColor: colors.border,
            shadowColor: colors.foreground,
          },
          pressed && styles.pressed,
        ]}
      >
        <SymbolView
          name={
            latest
              ? { ios: "arrow.down", android: "arrow_downward" }
              : { ios: "arrow.up", android: "arrow_upward" }
          }
          size={18}
          tintColor={colors.foreground}
        />
        {latest && unseen ? (
          <View
            style={[
              styles.dot,
              { backgroundColor: colors.tint, borderColor: colors.popover },
            ]}
          />
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: space.md,
    alignItems: "center",
  },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pressed: { opacity: 0.6 },
  dot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
  },
});
