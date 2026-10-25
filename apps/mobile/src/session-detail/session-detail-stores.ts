import { useCallback, useSyncExternalStore } from "react";
import { hostConnection } from "@/connection";
import {
  createSessionDetailStore,
  type SessionDetailStore,
} from "./session-detail-store";

const stores = new Map<string, SessionDetailStore>();

function sessionDetailStore(hostId: string, sessionId: string) {
  const key = JSON.stringify([hostId, sessionId]);
  const existing = stores.get(key);
  if (existing) return { key, store: existing };
  const store = createSessionDetailStore(hostConnection(hostId), sessionId);
  stores.set(key, store);
  return { key, store };
}

function subscribeSessionDetail(
  hostId: string,
  sessionId: string,
  listener: () => void,
) {
  const { key, store } = sessionDetailStore(hostId, sessionId);
  const unsubscribe = store.subscribe(listener);
  return () => {
    unsubscribe();
    if (!store.observed() && stores.get(key) === store) stores.delete(key);
  };
}

export function useSessionDetail(hostId: string, sessionId: string) {
  const subscribe = useCallback(
    (listener: () => void) =>
      subscribeSessionDetail(hostId, sessionId, listener),
    [hostId, sessionId],
  );
  return useSyncExternalStore(subscribe, () =>
    sessionDetailStore(hostId, sessionId).store.getSnapshot(),
  );
}
