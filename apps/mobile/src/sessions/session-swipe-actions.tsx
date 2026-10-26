import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { useThemeColors } from "@/theme";

const ACTION_WIDTH = 80;

function SwipeAction({
  label,
  background,
  color,
  testID,
  onPress,
}: {
  label: string;
  background: string;
  color: string;
  testID: string;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.action, { backgroundColor: background }]}
      testID={testID}
    >
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function SessionSwipeActions({
  sessionId,
  onMore,
  onArchive,
  children,
}: {
  sessionId: string;
  onMore(): void;
  onArchive: (() => void) | null;
  children: ReactNode;
}) {
  const { t } = useTranslation("sessions");
  const colors = useThemeColors();
  const [revealed, setRevealed] = useState(false);
  const renderActions = (
    _progress: unknown,
    _translation: unknown,
    swipeable: SwipeableMethods,
  ) => {
    const run = (action: () => void) => () => {
      swipeable.close();
      action();
    };
    return (
      <View
        style={styles.actions}
        accessibilityElementsHidden={!revealed}
        importantForAccessibility={revealed ? "auto" : "no-hide-descendants"}
      >
        <SwipeAction
          label={t("actions.more")}
          background={colors.mutedForeground}
          color={colors.background}
          testID={`session-swipe-more-${sessionId}`}
          onPress={run(onMore)}
        />
        {onArchive ? (
          <SwipeAction
            label={t("actions.archive")}
            background={colors.foreground}
            color={colors.background}
            testID={`session-swipe-archive-${sessionId}`}
            onPress={run(onArchive)}
          />
        ) : null}
      </View>
    );
  };
  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={ACTION_WIDTH / 2}
      overshootRight={false}
      renderRightActions={renderActions}
      childrenContainerStyle={{ backgroundColor: colors.background }}
      onSwipeableOpenStartDrag={() => setRevealed(true)}
      onSwipeableWillOpen={() => setRevealed(true)}
      onSwipeableClose={() => setRevealed(false)}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row" },
  action: {
    width: ACTION_WIDTH,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 15, fontWeight: "500" },
});
