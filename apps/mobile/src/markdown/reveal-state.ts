import { getNextRevealLength } from "@cocurdex/shared";

const MAX_STEP_MS = 100;

export type Reveal = { shown: number; at: number | null; pacing: boolean };

export function nextReveal(
  reveal: Reveal,
  content: string,
  streaming: boolean,
  now: number,
): Reveal {
  const shown = Math.min(reveal.shown, content.length);
  const caughtUp = shown >= content.length;
  const pacing = streaming || (reveal.pacing && !caughtUp);
  if (!pacing) return { shown: content.length, at: null, pacing };
  if (caughtUp) return { shown, at: null, pacing };
  if (reveal.at === null || now <= reveal.at) {
    return { shown, at: reveal.at ?? now, pacing };
  }
  return {
    shown: getNextRevealLength(
      content,
      shown,
      Math.min(now - reveal.at, MAX_STEP_MS),
    ),
    at: now,
    pacing,
  };
}

export function sameReveal(left: Reveal, right: Reveal) {
  return (
    left.shown === right.shown &&
    left.at === right.at &&
    left.pacing === right.pacing
  );
}
