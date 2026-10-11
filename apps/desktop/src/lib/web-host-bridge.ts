import type { DaemonConnectionInfo } from "@cocurdex/rpc";
import { offlineApi } from "./offline-api";
import type { HostBridge } from "./types";

const TOKEN_STORAGE_KEY = "cocurdex.daemonToken";

interface WebLocation {
  readonly hash: string;
  readonly host: string;
  readonly protocol: string;
}

interface TokenStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readFragmentToken(hash: string) {
  const token = new URLSearchParams(hash.replace(/^#/, "")).get("token");
  return token && token.length > 0 ? token : null;
}

function safeStore(read: () => TokenStore): TokenStore | null {
  try {
    return read();
  } catch {
    return null;
  }
}

export function resolveWebDaemonConnection(
  location: WebLocation,
  store: TokenStore | null,
): DaemonConnectionInfo | null {
  const fragmentToken = readFragmentToken(location.hash);
  if (fragmentToken) {
    try {
      store?.setItem(TOKEN_STORAGE_KEY, fragmentToken);
    } catch {}
  }
  let token = fragmentToken;
  if (!token) {
    try {
      token = store?.getItem(TOKEN_STORAGE_KEY) ?? null;
    } catch {
      token = null;
    }
  }
  if (!token) return null;
  const scheme = location.protocol === "https:" ? "wss:" : "ws:";
  return { token, webSocketUrl: `${scheme}//${location.host}` };
}

function dropFragmentToken() {
  if (!readFragmentToken(window.location.hash)) return;
  const { pathname, search } = window.location;
  window.history.replaceState(window.history.state, "", pathname + search);
}

export function createWebHostBridge(): HostBridge {
  const store = safeStore(() => window.sessionStorage);
  const connection = resolveWebDaemonConnection(window.location, store);
  dropFragmentToken();
  return {
    ...offlineApi,
    capabilities: {
      fileManager: false,
      nativeDirectoryDialog: false,
      terminal: false,
      browserView: false,
    },
    getDaemonConnection: async () => connection,
    openExternal: async (url) => {
      window.open(url, "_blank", "noopener,noreferrer");
    },
  };
}

export function installWebHostBridge() {
  if (window.desktopApi) return;
  window.desktopApi = createWebHostBridge();
}
