import type { AgentId, CreateSessionPayload } from "@cocurdex/shared";
import useSWR from "swr";
import { hostConnection } from "@/connection";
import type { NewSessionDraft } from "./new-session-draft";

const DAEMON_READ = { dedupingInterval: 0 };

export function useAgents(hostId: string) {
  return useSWR(
    ["agent.list", hostId] as const,
    ([method, host]) => hostConnection(host).request(method),
    DAEMON_READ,
  );
}

export function useCompatibleModels(hostId: string, agentId: AgentId | null) {
  return useSWR(
    agentId
      ? (["provider.listCompatibleForAgent", hostId, agentId] as const)
      : null,
    ([method, host, agent]) =>
      hostConnection(host).request(method, { agentId: agent }),
    DAEMON_READ,
  );
}

export function newSessionPayload(
  workspaceId: string,
  draft: NewSessionDraft,
): CreateSessionPayload {
  return {
    workspaceId,
    agentType: draft.agentType,
    model: draft.model,
    permissionMode: draft.permissionMode,
  };
}

export function useNewSessionDefaults(
  hostId: string,
  workspaceId: string | null,
  draft: NewSessionDraft,
) {
  return useSWR(
    workspaceId
      ? ([
          "session.resolveNew",
          hostId,
          newSessionPayload(workspaceId, draft),
        ] as const)
      : null,
    ([method, host, payload]) => hostConnection(host).request(method, payload),
    { ...DAEMON_READ, keepPreviousData: true },
  );
}
