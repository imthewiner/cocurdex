import { useState, useSyncExternalStore } from "react";
import {
  revealClockNow,
  subscribeNothing,
  subscribeRevealClock,
} from "./reveal-clock";
import { nextReveal, type Reveal, sameReveal } from "./reveal-state";

export function useStreamingReveal(content: string, streaming: boolean) {
  const [reveal, setReveal] = useState<Reveal>(() => ({
    shown: content.length,
    at: null,
    pacing: streaming,
  }));
  const ticking = reveal.pacing && reveal.shown < content.length;
  const now = useSyncExternalStore(
    ticking ? subscribeRevealClock : subscribeNothing,
    revealClockNow,
  );
  const next = nextReveal(reveal, content, streaming, now);
  if (!sameReveal(reveal, next)) setReveal(next);
  return {
    content: next.pacing ? content.slice(0, next.shown) : content,
    live: next.pacing,
  };
}
