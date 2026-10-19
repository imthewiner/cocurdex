import { buildDaemonDeckAssetUrl } from "@cocurdex/shared";
import { useCallback, useSyncExternalStore } from "react";
import { logRendererDiagnostic, resolveLocalDaemonConnection } from "@/lib";

const RELEASE_DELAY_MS = 60_000;

interface Entry {
  url: string | null;
  listeners: Set<() => void>;
  releaseTimer: ReturnType<typeof setTimeout> | null;
}

const entries = new Map<string, Entry>();

function notify(entry: Entry) {
  for (const listener of entry.listeners) listener();
}

async function fetchImage(hash: string, entry: Entry) {
  try {
    const connection = await resolveLocalDaemonConnection();
    const response = await fetch(
      buildDaemonDeckAssetUrl(connection.webSocketUrl, hash),
      { headers: { Authorization: `Bearer ${connection.token}` } },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const url = URL.createObjectURL(await response.blob());
    if (entries.get(hash) !== entry) {
      URL.revokeObjectURL(url);
      return;
    }
    entry.url = url;
    notify(entry);
  } catch (error) {
    logRendererDiagnostic("info", "decks.imageLoadFailed", {
      hash,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function release(hash: string, entry: Entry) {
  entry.releaseTimer = null;
  if (entry.listeners.size > 0) return;
  entries.delete(hash);
  if (entry.url) URL.revokeObjectURL(entry.url);
}

function subscribe(hash: string, listener: () => void) {
  let entry = entries.get(hash);
  if (!entry) {
    entry = {
      url: null,
      listeners: new Set(),
      releaseTimer: null,
    };
    entries.set(hash, entry);
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
