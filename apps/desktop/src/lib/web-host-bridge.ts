import {
  createSavedHostStore,
  type FetchLike,
  HostAccessError,
  type KeyValueStorage,
  pairHost,
  type SavedHost,
  type SavedHostStore,
  verifyHostCredential,
} from "@cocurdex/client-runtime";
import type { DaemonConnectionInfo } from "@cocurdex/rpc";
import { offlineApi } from "./offline-api";
import type { HostBridge } from "./types";

const TOKEN_STORAGE_KEY = "cocurdex.daemonToken";

export type WebPairingReason =
  | "missing"
  | "invalid"
  | "rateLimited"
  | "unreachable";

export type WebHostAccess =
  | { kind: "local"; connection: DaemonConnectionInfo }
  | { kind: "device"; connection: DaemonConnectionInfo; host: SavedHost }
  | { kind: "needsPairing"; reason: WebPairingReason };

export interface WebLocation {
  readonly hash: string;
  readonly host: string;
  readonly origin: string;
  readonly protocol: string;
}

export interface WebHostAccessDeps {
  sessionStore: KeyValueStorage | null;
  savedHosts: SavedHostStore;
  fetch?: FetchLike;
}

function readFragment(hash: string) {
  return new URLSearchParams(hash.replace(/^#/, ""));
}

function nonEmpty(value: string | null | undefined) {
  return value && value.length > 0 ? value : null;
}

function webSocketUrlFor(location: WebLocation) {
  const scheme = location.protocol === "https:" ? "wss:" : "ws:";
  return `${scheme}//${location.host}`;
}

function failureReason(error: unknown): WebPairingReason {
  return error instanceof HostAccessError ? error.reason : "unreachable";
}

function readStoredToken(store: KeyValueStorage | null) {
  try {
    return nonEmpty(store?.getItem(TOKEN_STORAGE_KEY));
  } catch {
    return null;
  }
}

function localAccess(location: WebLocation, token: string): WebHostAccess {
  return {
    kind: "local",
    connection: { token, webSocketUrl: webSocketUrlFor(location) },
  };
}

function deviceAccess(location: WebLocation, host: SavedHost): WebHostAccess {
  return {
    kind: "device",
    host,
    connection: { token: host.token, webSocketUrl: webSocketUrlFor(location) },
  };
}

async function tryPairing(
  location: WebLocation,
  code: string,
  deps: WebHostAccessDeps,
) {
  try {
    const host = await pairHost({
      baseUrl: location.origin,
      code,
      store: deps.savedHosts,
      fetch: deps.fetch,
    });
    return { host, failure: null };
  } catch (error) {
    return { host: null, failure: failureReason(error) };
  }
}

export async function resolveWebHostAccess(
  location: WebLocation,
  deps: WebHostAccessDeps,
): Promise<WebHostAccess> {
  const fragment = readFragment(location.hash);
  const localToken = nonEmpty(fragment.get("token"));
  if (localToken) {
    try {
      deps.sessionStore?.setItem(TOKEN_STORAGE_KEY, localToken);
    } catch {}
    return localAccess(location, localToken);
  }

  const code = nonEmpty(fragment.get("pair"));
  const pairing = code ? await tryPairing(location, code, deps) : null;
  if (pairing?.host) return deviceAccess(location, pairing.host);

  const saved = deps.savedHosts.findByBaseUrl(location.origin);
  if (saved) {
    try {
      await verifyHostCredential({
        baseUrl: location.origin,
        token: saved.token,
        fetch: deps.fetch,
      });
    } catch (error) {
      if (failureReason(error) === "invalid") {
        deps.savedHosts.remove(saved.hostId);
        return { kind: "needsPairing", reason: "invalid" };
      }
    }
    return deviceAccess(location, saved);
  }

  const storedToken = readStoredToken(deps.sessionStore);
  if (storedToken && !pairing) return localAccess(location, storedToken);
  return { kind: "needsPairing", reason: pairing?.failure ?? "missing" };
}

function safeStore(read: () => KeyValueStorage): KeyValueStorage | null {
  try {
    return read();
  } catch {
    return null;
  }
}

function savedHostStore() {
  return createSavedHostStore(safeStore(() => window.localStorage));
}

function snapshotLocation(): WebLocation {
  const { hash, host, origin, protocol } = window.location;
  return { hash, host, origin, protocol };
}

function dropFragmentCredentials() {
  const fragment = readFragment(window.location.hash);
  if (!fragment.has("token") && !fragment.has("pair")) return;
  const { pathname, search } = window.location;
  window.history.replaceState(window.history.state, "", pathname + search);
}

function createConnectionResolver(
  access: Promise<WebHostAccess>,
  savedHosts: SavedHostStore,
) {
  let verified = false;
  return async (): Promise<DaemonConnectionInfo | null> => {
    const resolved = await access;
    if (resolved.kind === "needsPairing") return null;
    if (resolved.kind === "local" || !verified) {
      verified = true;
      return resolved.connection;
    }
    try {
      await verifyHostCredential({
        baseUrl: resolved.host.baseUrl,
        token: resolved.host.token,
      });
    } catch (error) {
      if (failureReason(error) === "invalid") {
        savedHosts.remove(resolved.host.hostId);
        window.location.reload();
        return null;
      }
    }
    return resolved.connection;
  };
}

export async function pairThisBrowser(code: string) {
  await pairHost({
    baseUrl: window.location.origin,
    code: code.trim(),
    store: savedHostStore(),
  });
}

export function webPairingFailureReason(error: unknown) {
  return failureReason(error);
}

export function installWebHostBridge(): Promise<WebHostAccess> | null {
  if (window.desktopApi) return null;
  const savedHosts = savedHostStore();
  const access = resolveWebHostAccess(snapshotLocation(), {
    sessionStore: safeStore(() => window.sessionStorage),
    savedHosts,
  });
  dropFragmentCredentials();
  const bridge: HostBridge = {
    ...offlineApi,
    capabilities: {
      fileManager: false,
      nativeDirectoryDialog: false,
      terminal: false,
      browserView: false,
    },
    getDaemonConnection: createConnectionResolver(access, savedHosts),
    openExternal: async (url) => {
      window.open(url, "_blank", "noopener,noreferrer");
    },
  };
  window.desktopApi = bridge;
  return access;
}
