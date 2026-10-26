const FRAME_MS = 50;

const listeners = new Set<() => void>();
let now = 0;
let timer: ReturnType<typeof setInterval> | null = null;

function tick() {
  now = performance.now();
  for (const listener of listeners) listener();
}

export function subscribeRevealClock(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    now = performance.now();
    timer = setInterval(tick, FRAME_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0 || !timer) return;
    clearInterval(timer);
    timer = null;
  };
}

export function revealClockNow() {
  return now;
}

export function subscribeNothing() {
  return () => {};
}
