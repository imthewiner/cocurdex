import { useNavigation } from "expo-router";
import { useEffect, useState } from "react";

const SETTLE_FALLBACK_MS = 600;

export function useTransitionSettled() {
  const navigation = useNavigation();
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (settled) return;
    const settle = () => setSettled(true);
    const fallback = setTimeout(settle, SETTLE_FALLBACK_MS);
    const unsubscribe = navigation.addListener(
      "transitionEnd" as never,
      settle,
    );
    return () => {
      clearTimeout(fallback);
      unsubscribe();
    };
  }, [navigation, settled]);
  return settled;
}
