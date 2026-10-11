import type { AgentEvent, DaemonEventMeta } from "@cocurdex/shared";
import { contextBridge, ipcRenderer } from "electron";
import type { TaskEventBridge } from "../../src/lib/types";

export function exposeTaskEvents() {
  const bridge: TaskEventBridge = {
    onAgentEvent(listener) {
      const handler = (
        _event: Electron.IpcRendererEvent,
        event: AgentEvent,
        meta: DaemonEventMeta,
      ) => listener(event, meta);
      ipcRenderer.on("agent:event", handler);
      return () => ipcRenderer.removeListener("agent:event", handler);
    },
  };
  contextBridge.exposeInMainWorld("taskEvents", bridge);
}
