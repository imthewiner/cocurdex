import { type ReactNode, useState } from "react";
import { AccessibilityInfo, Animated, Easing } from "react-native";

const FADE_MS = 400;

function startFade(opacity: Animated.Value) {
  const fade = Animated.timing(opacity, {
    toValue: 1,
    duration: FADE_MS,
    easing: Easing.out(Easing.quad),
    useNativeDriver: true,
  });
  let stopped = false;
  void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
    if (stopped) return;
    if (reduced) opacity.setValue(1);
    else fade.start();
  });
  return () => {
    stopped = true;
    fade.stop();
    opacity.setValue(1);
  };
}

export function FadeInBlock({
  fade,
  children,
}: {
  fade: boolean;
  children: ReactNode;
}) {
  const [fading] = useState(fade);
  const [opacity] = useState(() => new Animated.Value(0));
  const [attach] = useState(() => (node: unknown) => {
    if (node) return startFade(opacity);
  });
  if (!fading) return children;
  return (
    <Animated.View ref={attach} style={{ opacity }}>
      {children}
    </Animated.View>
  );
}
