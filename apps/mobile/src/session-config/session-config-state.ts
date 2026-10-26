import type { SavedHost } from "@cocurdex/client-runtime";
import {
  getSessionRuntimeAxes,
  snapshotRuntimeSelection,
} from "@cocurdex/shared";
import { useAgents, useCompatibleModels } from "@/agents";
import { useViewedSession } from "@/sessions";

export function useSessionConfigState(host: SavedHost, sessionId: string) {
  const viewed = useViewedSession(host.hostId, sessionId);
  const session = viewed.sessions.find((entry) => entry.id === sessionId);
  const agentType = session?.agentType ?? null;
  const agents = useAgents(host.hostId).data ?? [];
  const agent = agents.find((entry) => entry.id === agentType);
  const models = useCompatibleModels(host.hostId, agentType).data ?? [];
  const snapshot = session?.providerSnapshot ?? null;
  const selected = models.find(
    ({ provider, model }) =>
      snapshot?.providerId === provider.id &&
      snapshot.modelId === model.modelId,
  );
  const axes =
    session && snapshot
      ? getSessionRuntimeAxes(
          session.agentType,
          selected?.model,
          snapshotRuntimeSelection(snapshot),
          snapshot,
        )
      : null;
  return { session, agent, models, snapshot, axes };
}
