import { buildDaemonDeckAssetUrl } from "@cocurdex/shared";
import { useCallback, useSyncExternalStore } from "react";
import { logRendererDiagnostic, resolveLocalDaemonConnection } from "@/lib";

const RELEASE_DELAY_MS = 60_000;
const RETRY_DELAYS_MS = [1_000, 3_000, 10_000];

interface Entry {
  url: string | null;
  listeners: Set<() => void>;
  releaseTimer: ReturnType<typeof setTimeout> | null;
  retryTimer: ReturnType<typeof setTimeout> | null;
  failedAttempts: number;
  loading: boolean;
}

const entries = new Map<string, Entry>();

function notify(entry: Entry) {
  for (const listener of entry.listeners) listener();
}

function isCurrent(hash: string, entry: Entry) {
  return entries.get(hash) === entry;
}

function scheduleRetry(hash: string, entry: Entry) {
  const delay = RETRY_DELAYS_MS[entry.failedAttempts - 1];
  if (delay === undefined) return;
  entry.retryTimer = setTimeout(() => {
    entry.retryTimer = null;
    if (isCurrent(hash, entry) && entry.listeners.size > 0) {
      void fetchImage(hash, entry);
    }
  }, delay);
}

async function fetchImage(hash: string, entry: Entry) {
  entry.loading = true;
  try {
    const connection = await resolveLocalDaemonConnection();
    const response = await fetch(
      buildDaemonDeckAssetUrl(connection.webSocketUrl, hash),
      { headers: { Authorization: `Bearer ${connection.token}` } },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const url = URL.createObjectURL(await response.blob());
    entry.loading = false;
    if (!isCurrent(hash, entry)) {
      URL.revokeObjectURL(url);
      return;
    }
    entry.url = url;
    notify(entry);
  } catch (error) {
    entry.loading = false;
    entry.failedAttempts += 1;
    logRendererDiagnostic("info", "decks.imageLoadFailed", {
      hash,
      attempt: entry.failedAttempts,
      error: error instanceof Error ? error.message : String(error),
    });
    scheduleRetry(hash, entry);
  }
}

function needsFetch(entry: Entry) {
  return !entry.url && !entry.loading && !entry.retryTimer;
}

function release(hash: string, entry: Entry) {
  entry.releaseTimer = null;
  if (entry.listeners.size > 0) return;
  entries.delete(hash);
  if (entry.retryTimer) clearTimeout(entry.retryTimer);
  if (entry.url) URL.revokeObjectURL(entry.url);
}

function subscribe(hash: string, listener: () => void) {
  let entry = entries.get(hash);
  if (!entry) {
    entry = {
      url: null,
      listeners: new Set(),
      releaseTimer: null,
      retryTimer: null,
      failedAttempts: 0,
      loading: false,
    };
    entries.set(hash, entry);
    void fetchImage(hash, entry);
  } else if (needsFetch(entry)) {
    entry.failedAttempts = 0;
    void fetchImage(hash, entry);
  }
  const current = entry;
  if (current.releaseTimer) clearTimeout(current.releaseTimer);
  current.releaseTimer = null;
  current.listeners.add(listener);
  return () => {
    current.listeners.delete(listener);
    if (current.listeners.size === 0 && !current.releaseTimer) {
      current.releaseTimer = setTimeout(
        () => release(hash, current),
        RELEASE_DELAY_MS,
      );
    }
  };
}

export function useDeckImageUrl(hash: string): string | null {
  const subscribeToHash = useCallback(
    (listener: () => void) => subscribe(hash, listener),
    [hash],
  );
  return useSyncExternalStore(
    subscribeToHash,
    () => entries.get(hash)?.url ?? null,
  );
}
