import type { JumpButtonKind } from "@cocurdex/shared";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { layout, space, useThemeColors, useThemeName } from "@/theme";

const SIZE = 40;
const DOT = 10;
const FILL = { light: "#e5e5e5", dark: "#333333" } as const;

export function JumpButton({
  target,
  streaming = false,
  unseen,
  onPress,
}: {
  target: Exclude<JumpButtonKind, null>;
  streaming?: boolean;
  unseen: boolean;
  onPress(): void;
}) {
  const { t } = useTranslation("sessions");
  const colors = useThemeColors();
  const fill = FILL[useThemeName()];
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
          { backgroundColor: fill },
          pressed && styles.pressed,
        ]}
      >
        {latest && streaming ? <StreamingRing color={colors.tint} /> : null}
        <SymbolView
          name={
            latest
              ? { ios: "arrow.down", android: "arrow_downward" }
              : { ios: "arrow.up", android: "arrow_upward" }
          }
          size={18}
          tintColor={colors.foreground}
        />

        {latest && unseen && !streaming ? (
          <View
            style={[
              styles.dot,
              { backgroundColor: colors.tint, borderColor: fill },
            ]}
          />
        ) : null}
      </Pressable>
    </View>
  );
}

function StreamingRing({ color }: { color: string }) {
  const [rotation] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(true);
  const [attach] = useState(() => (node: unknown) => {
    if (!node) return;
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    const update = (reduced: boolean) => {
      if (!active) return;
      animation?.stop();
      rotation.setValue(0);
      setReduceMotion(reduced);
      if (reduced) return;
      animation = Animated.loop(
        Animated.timing(rotation, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
          isInteraction: false,
        }),
      );
      animation.start();
    };
    void AccessibilityInfo.isReduceMotionEnabled().then(update);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      update,
    );
    return () => {
      active = false;
      animation?.stop();
      subscription.remove();
    };
  });
  return (
    <View
      ref={attach}
      pointerEvents="none"
      accessible={false}
      style={StyleSheet.absoluteFill}
    >
      <View
        style={[
          styles.ring,
          { borderColor: color, opacity: reduceMotion ? 1 : 0.2 },
        ]}
      />
      {!reduceMotion ? (
        <Animated.View
          style={[
            styles.ring,
            {
              borderColor: "transparent",
              borderTopColor: color,
              transform: [
                {
                  rotate: rotation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", "360deg"],
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    position: "absolute",
    end: layout.sideMargin,
    bottom: space.lg,
  },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    ...StyleSheet.absoluteFill,
    borderRadius: SIZE / 2,
    borderWidth: 2,
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
