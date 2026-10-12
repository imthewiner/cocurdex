import type {
  PtyActivityEvent,
  PtyDataEvent,
  PtyExitEvent,
  PtySpawnPayload,
  PtySpawnResult,
  RendererLogPayload,
} from "@cocurdex/shared";
import { contextBridge, ipcRenderer, webUtils } from "electron";
import type {
  AppUpdateChannel,
  AppUpdateState,
  BrowserAnnotationActionEvent,
  BrowserAnnotationEvent,
  BrowserViewBounds,
  HostBridge,
} from "../src/lib/types";
import { chatWindowApi } from "./window/chat-window-preload";

const hostBridge: HostBridge = {
  chatWindow: chatWindowApi,
  capabilities: {
    fileManager: true,
    nativeDirectoryDialog: true,
    terminal: true,
    browserView: true,
    localWebClient: true,
  },
  // Sandboxed preload cannot import node:os — resolve home in main.
  // Default terminal cwd when no workspace is open.
  getHomeDir: () => ipcRenderer.invoke("app:getHomeDir") as Promise<string>,
  listFontFamilies: () =>
    ipcRenderer.invoke("app:listFontFamilies") as Promise<string[]>,
  getAppUpdateState: () => ipcRenderer.invoke("app:update:getState"),
  checkForAppUpdate: () => ipcRenderer.invoke("app:update:check"),
  dismissAppUpdate: () => ipcRenderer.invoke("app:update:dismiss"),
  setAppUpdateChannel: (channel: AppUpdateChannel) =>
    ipcRenderer.invoke("app:update:setChannel", channel),
  installAppUpdate: () => ipcRenderer.invoke("app:update:install"),
  getOssLicenses: () => ipcRenderer.invoke("app:getOssLicenses"),
  openChromiumLicenses: () => ipcRenderer.invoke("app:openChromiumLicenses"),
  onAppUpdateState: (listener: (state: AppUpdateState) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      payload: AppUpdateState,
    ) => {
      listener(payload);
    };
    ipcRenderer.on("app:updateState", handler);
    return () => {
      ipcRenderer.removeListener("app:updateState", handler);
    };
  },
  openWorkspaceInFileManager: (rootPath: string) =>
    ipcRenderer.invoke("workspace:openInFileManager", rootPath),
  revealPathInFileManager: (targetPath: string) =>
    ipcRenderer.invoke("workspace:revealPath", targetPath),
  readPdfData: (payload: { filePath: string }) =>
    ipcRenderer.invoke("pdf:read-data", payload) as Promise<string>,
  openWorkspace: () => ipcRenderer.invoke("dialog:openDirectory"),
  consumePendingOpenFolder: () =>
    ipcRenderer.invoke("workspace:consumeOpenFolder") as Promise<{
      rootPath: string;
    } | null>,
  // Electron no longer exposes File.path on the renderer File object; resolve
  // local drag-and-drop paths through webUtils in the preload bridge.
  getPathForFile: (file: File) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return null;
    }
  },
  resolveWorkspaceOpenPath: (filePath: string) =>
    ipcRenderer.invoke("workspace:resolveOpenPath", filePath) as Promise<{
      rootPath: string;
    } | null>,
  onOpenWorkspaceFromCli: (listener: (event: { rootPath: string }) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      payload: { rootPath: string },
    ) => {
      listener(payload);
    };

    ipcRenderer.on("workspace:openFromCli", handler);
    return () => {
      ipcRenderer.removeListener("workspace:openFromCli", handler);
    };
  },
  setWindowSurfaceColor: (color: string) =>
    ipcRenderer.invoke("window:setSurfaceColor", color),
  browserNavigate: (url: string) => ipcRenderer.invoke("browser:navigate", url),
  browserUpdateHtml: (
    url: string,
    html: string,
    contentKey: string,
    streaming: boolean,
  ) =>
    ipcRenderer.invoke("browser:updateHtml", {
      url,
      html,
      contentKey,
      streaming,
    }),
  browserOpenHtml: (html: string, sourceId: string, streaming: boolean) =>
    ipcRenderer.invoke("browser:openHtml", { html, sourceId, streaming }),
  browserReload: () => ipcRenderer.invoke("browser:reload"),
  browserStop: () => ipcRenderer.invoke("browser:stop"),
  browserGoBack: () => ipcRenderer.invoke("browser:goBack"),
  browserGoForward: () => ipcRenderer.invoke("browser:goForward"),
  browserToggleAnnotationMode: (enabled: boolean) =>
    ipcRenderer.invoke("browser:toggleAnnotationMode", enabled),
  browserCaptureScreenshot: () =>
    ipcRenderer.invoke("browser:captureScreenshot"),
  browserListTabs: () => ipcRenderer.invoke("browser:listTabs"),
  browserNewTab: () => ipcRenderer.invoke("browser:newTab"),
  browserActivateTab: (id: string) =>
    ipcRenderer.invoke("browser:activateTab", id),
  browserCloseTab: (id: string) => ipcRenderer.invoke("browser:closeTab", id),
  onBrowserTabs: (
    listener: (
      snapshot: import("@cocurdex/shared").BrowserTabsSnapshot,
    ) => void,
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      snapshot: import("@cocurdex/shared").BrowserTabsSnapshot,
    ) => listener(snapshot);
    ipcRenderer.on("browser:tabs", handler);
    return () => {
      ipcRenderer.removeListener("browser:tabs", handler);
    };
  },
  onBrowserAnnotation: (
    listener: (payload: BrowserAnnotationEvent) => void,
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      payload: BrowserAnnotationEvent,
    ) => listener(payload);
    ipcRenderer.on("browser:annotation", handler);
    return () => {
      ipcRenderer.removeListener("browser:annotation", handler);
    };
  },
  onBrowserAnnotationAction: (
    listener: (payload: BrowserAnnotationActionEvent) => void,
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      payload: BrowserAnnotationActionEvent,
    ) => listener(payload);
    ipcRenderer.on("browser:annotation:action", handler);
    return () => {
      ipcRenderer.removeListener("browser:annotation:action", handler);
    };
  },
  browserSetAnnotationMarkers: (tabId: string, ids: string[]) =>
    ipcRenderer.invoke("browser:setAnnotationMarkers", tabId, ids),
  setBrowserBounds: (bounds: BrowserViewBounds) =>
    ipcRenderer.invoke("browser:setBounds", bounds),
  browserShow: (visible: boolean) =>
    ipcRenderer.invoke("browser:show", visible),
  logRendererError: (payload: RendererLogPayload) =>
    ipcRenderer.invoke("log:rendererError", payload),
  exportDiagnostics: () => ipcRenderer.invoke("diagnostics:export"),
  getDiagnosticsVerbose: () => ipcRenderer.invoke("diagnostics:getVerbose"),
  setDiagnosticsVerbose: (enabled: boolean) =>
    ipcRenderer.invoke("diagnostics:setVerbose", enabled),
  openExternal: (url: string) => ipcRenderer.invoke("shell:openExternal", url),
  ptySpawn: (payload: PtySpawnPayload): Promise<PtySpawnResult> =>
    ipcRenderer.invoke("pty:spawn", payload),
  ptyWrite: (terminalId: string, data: string) =>
    ipcRenderer.invoke("pty:write", { terminalId, data }),
  ptyResize: (terminalId: string, cols: number, rows: number) =>
    ipcRenderer.invoke("pty:resize", { terminalId, cols, rows }),
  ptyKill: (terminalId: string) =>
    ipcRenderer.invoke("pty:kill", { terminalId }),
  onPtyData: (listener: (event: PtyDataEvent) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      payload: PtyDataEvent,
    ) => {
      listener(payload);
    };

    ipcRenderer.on("pty:data", handler);
    return () => {
      ipcRenderer.removeListener("pty:data", handler);
    };
  },
  onPtyExit: (listener: (event: PtyExitEvent) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      payload: PtyExitEvent,
    ) => {
      listener(payload);
    };

    ipcRenderer.on("pty:exit", handler);
    return () => {
      ipcRenderer.removeListener("pty:exit", handler);
    };
  },
  onPtyActivity: (listener: (event: PtyActivityEvent) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      payload: PtyActivityEvent,
    ) => {
      listener(payload);
    };

    ipcRenderer.on("pty:activity", handler);
    return () => {
      ipcRenderer.removeListener("pty:activity", handler);
    };
  },
  getCliPathStatus: () => ipcRenderer.invoke("cli:getPathStatus"),
  installCliOnPath: () => ipcRenderer.invoke("cli:installOnPath"),
  uninstallCliFromPath: () => ipcRenderer.invoke("cli:uninstallFromPath"),
  getDaemonStatus: () => ipcRenderer.invoke("daemon:getStatus"),
  getDaemonConnection: () => ipcRenderer.invoke("daemon:connection"),
  restartDaemon: () => ipcRenderer.invoke("daemon:restart"),
};

contextBridge.exposeInMainWorld("desktopApi", hostBridge);
