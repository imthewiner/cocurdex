import {
  type CocurdexDaemonEvent,
  cocurdexDataAreas,
  type DaemonEventMeta,
} from "@cocurdex/shared";
import type {
  DaemonEventSubscription,
  DaemonRpcSubscribeOptions,
} from "./client.ts";

export type DaemonEventSubscriber = (
  onEvent: (event: CocurdexDaemonEvent, meta: DaemonEventMeta) => void,
  options: DaemonRpcSubscribeOptions,
) => Promise<DaemonEventSubscription>;

export interface DaemonEventConnectionOptions {
  subscribe: DaemonEventSubscriber;
  ensure?(): Promise<void>;
  onEvent(event: CocurdexDaemonEvent, meta?: DaemonEventMeta): void;
  onConnected?(): void;
  onDisconnect?(error: Error): void;
  retryDelayMs?: number;
  maxRetryDelayMs?: number;
}

export type DaemonEventConnection = ReturnType<
  typeof createDaemonEventConnection
>;

function unrefTimer(timer: ReturnType<typeof setTimeout>) {
  (timer as { unref?: () => void }).unref?.();
}

export function createDaemonEventConnection(
  options: DaemonEventConnectionOptions,
) {
  let generation = 0;
  let disposed = false;
  let subscription: DaemonEventSubscription | null = null;
  let pending: Promise<void> | null = null;
  let controller: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastSeq: number | null = null;
  let lastEpoch: string | null = null;
  let failures = 0;

  function reset() {
    generation += 1;
    if (timer) clearTimeout(timer);
    timer = null;
    controller?.abort();
    controller = null;
    lastSeq = subscription?.lastSeq ?? lastSeq;
    lastEpoch = subscription?.epoch ?? lastEpoch;
    subscription?.close();
    subscription = null;
    pending = null;
  }

  function retryDelay() {
    const base = options.retryDelayMs ?? 500;
    const max = options.maxRetryDelayMs ?? 10_000;
    failures += 1;
    return Math.min(base * 2 ** (failures - 1), max);
  }

  function reconnect(attemptGeneration: number, error: Error) {
    if (disposed || attemptGeneration !== generation) return;
    reset();
    options.onDisconnect?.(error);
    timer = setTimeout(() => {
      timer = null;
      void connect();
    }, retryDelay());
    unrefTimer(timer);
  }

  function connect(): Promise<void> {
    if (disposed || subscription) return Promise.resolve();
    if (pending) return pending;
    if (timer) clearTimeout(timer);
    timer = null;
    const attemptGeneration = ++generation;
    const attemptController = new AbortController();
    controller = attemptController;
    const attempt = (async () => {
      try {
        await options.ensure?.();
        if (disposed || attemptGeneration !== generation) return;
        const connected = await options.subscribe(
          (event, meta) => {
            if (!disposed && attemptGeneration === generation)
              options.onEvent(event, meta);
          },
          {
            afterSeq: lastSeq ?? undefined,
            epoch: lastEpoch ?? undefined,
            signal: attemptController.signal,
            onDisconnect: (error) =>
              reconnect(
                attemptGeneration,
                error ?? new Error("Daemon disconnected"),
              ),
          },
        );
        if (disposed || attemptGeneration !== generation) {
          connected.close();
          return;
        }
        subscription = connected;
        failures = 0;
        if (connected.replayGap) {
          options.onEvent({
            type: "data.changed",
            areas: [...cocurdexDataAreas],
          });
        }
        options.onConnected?.();
      } catch (error) {
        reconnect(
          attemptGeneration,
          error instanceof Error ? error : new Error(String(error)),
        );
      } finally {
        if (attemptGeneration === generation) pending = null;
      }
    })();
    pending = attempt;
    return attempt;
  }

  return {
    connect,
    reset,
    dispose() {
      disposed = true;
      reset();
    },
  };
}
