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
import { space, useThemeColors, useThemeName } from "@/theme";

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
        <JumpIcon animated={latest && streaming}>
          <SymbolView
            name={
              latest
                ? { ios: "arrow.down", android: "arrow_downward" }
                : { ios: "arrow.up", android: "arrow_upward" }
            }
            size={18}
            tintColor={colors.foreground}
          />
        </JumpIcon>
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

function JumpIcon({
  animated,
  children,
}: {
  animated: boolean;
  children: React.ReactNode;
}) {
  return animated ? <PulsingIcon>{children}</PulsingIcon> : children;
}

function PulsingIcon({ children }: { children: React.ReactNode }) {
  const [opacity] = useState(() => new Animated.Value(1));
  const [attach] = useState(() => (node: unknown) => {
    if (!node) return;
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    const update = (reduceMotion: boolean) => {
      animation?.stop();
      opacity.setValue(1);
      if (!active || reduceMotion) return;
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.4,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
            isInteraction: false,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
            isInteraction: false,
          }),
        ]),
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
    <Animated.View ref={attach} style={{ opacity }}>
      {children}
    </Animated.View>
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
    alignItems: "center",
    justifyContent: "center",
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
