import {
  createDaemonEventConnection,
  type DaemonEventConnection,
} from "@cocurdex/rpc/event-connection";
import {
  type AgentEvent,
  type CocurdexDaemonEvent,
  type DaemonEventMeta,
  isAgentEvent,
} from "@cocurdex/shared";
import { subscribeDaemon } from "./daemon-client";
import type { ProductEventApi } from "./types";

type DaemonEventListener = (
  event: CocurdexDaemonEvent,
  meta: DaemonEventMeta,
) => void;

const unknownPosition: DaemonEventMeta = { epoch: null, seq: null };
const listeners = new Set<DaemonEventListener>();
let connection: DaemonEventConnection | null = null;

function dispatch(event: CocurdexDaemonEvent, meta?: DaemonEventMeta) {
  for (const listener of [...listeners])
    listener(event, meta ?? unknownPosition);
}

export function onDaemonEvent(listener: DaemonEventListener): () => void {
  listeners.add(listener);
  if (!connection) {
    connection = createDaemonEventConnection({
      subscribe: subscribeDaemon,
      onEvent: dispatch,
    });
    void connection.connect();
  }
  return () => {
    listeners.delete(listener);
  };
}

export function onDaemonAgentEvent(
  listener: (event: AgentEvent, meta: DaemonEventMeta) => void,
): () => void {
  return onDaemonEvent((event, meta) => {
    if (isAgentEvent(event)) listener(event, meta);
  });
}

function onEventType<T extends CocurdexDaemonEvent["type"], P>(
  type: T,
  select: (event: Extract<CocurdexDaemonEvent, { type: T }>) => P,
) {
  return (listener: (payload: P) => void) =>
    onDaemonEvent((event) => {
      if (event.type === type) {
        listener(select(event as Extract<CocurdexDaemonEvent, { type: T }>));
      }
    });
}

export const daemonEventApi: ProductEventApi = {
  onDataChanged: onEventType("data.changed", (event) => event),
  onWorkspaceFilesChanged: onEventType(
    "workspace.filesChanged",
    ({ rootPath }) => ({ rootPath }),
  ),
  onWorkspaceGitStateChanged: onEventType(
    "workspace.gitStateChanged",
    ({ rootPath }) => ({ rootPath }),
  ),
  onWorkspaceSearchResult: onEventType(
    "search.result",
    ({ batch, searchId }) => ({ batch, searchId }),
  ),
  onWorkspaceSearchDone: onEventType("search.done", ({ reason, searchId }) => ({
    reason,
    searchId,
  })),
  onWorkspaceSearchError: onEventType(
    "search.error",
    ({ message, searchId }) => ({ message, searchId }),
  ),
};
