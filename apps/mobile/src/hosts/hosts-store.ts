import {
  createSavedHostStore,
  HostAccessError,
  type KeyValueStorage,
  pairHost,
  type SavedHost,
} from "@cocurdex/client-runtime";
import { parseHostPairingLink } from "@cocurdex/shared";

export type PairFailure = "link" | "invalid" | "rateLimited" | "unreachable";

export function createHostsStore(storage: KeyValueStorage) {
  const store = createSavedHostStore(storage);
  const listeners = new Set<() => void>();
  let snapshot: SavedHost[] = store.list();

  const publish = () => {
    snapshot = store.list();
    for (const listener of listeners) listener();
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    async pair(
      link: string,
      label: string,
      fetchImpl?: typeof fetch,
    ): Promise<{ host: SavedHost } | { failure: PairFailure }> {
      const parsed = parseHostPairingLink(link);
      if (!parsed) return { failure: "link" };
      try {
        const host = await pairHost({
          ...parsed,
          label,
          store,
          fetch: fetchImpl,
        });
        publish();
        return { host };
      } catch (error) {
        if (error instanceof HostAccessError) return { failure: error.reason };
        throw error;
      }
    },
    remove(hostId: string) {
      store.remove(hostId);
      publish();
    },
    clear() {
      store.clear();
      publish();
    },
  };
}

export type HostsStore = ReturnType<typeof createHostsStore>;

export interface InstallMarker {
  exists(): boolean;
  create(): void;
}

export function forgetHostsFromPreviousInstall(
  marker: InstallMarker,
  hosts: Pick<HostsStore, "clear">,
) {
  if (marker.exists()) return;
  hosts.clear();
  marker.create();
}
