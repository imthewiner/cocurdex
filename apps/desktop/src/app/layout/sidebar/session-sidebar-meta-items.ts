import type { AgentId, SessionRecord } from "@cocurdex/shared";
import { getAgentDisplayLabel } from "@/features/sessions";
import type { SessionProperty } from "@/features/sessions/session-list-view";

export interface SessionMetaItem {
  agentId?: AgentId;
  key: SessionProperty;
  label: string;
}

interface SessionMetaSource {
  roleName?: string;
  session: SessionRecord;
  workspaceName?: string;
}

function worktreeName(worktreePath: string) {
  return worktreePath.split(/[\\/]/).filter(Boolean).at(-1) ?? worktreePath;
}

function resolveMetaItem(
  property: SessionProperty,
  { roleName, session, workspaceName }: SessionMetaSource,
): SessionMetaItem | null {
  switch (property) {
    case "agent":
      return {
        agentId: session.agentType,
        key: property,
        label: getAgentDisplayLabel(session.agentType),
      };
    case "model": {
      const modelName = session.providerSnapshot?.modelName;
      return modelName ? { key: property, label: modelName } : null;
    }
    case "role":
      return roleName ? { key: property, label: roleName } : null;
    case "workspace":
      return workspaceName ? { key: property, label: workspaceName } : null;
    case "worktree":
      return session.worktreePath
        ? { key: property, label: worktreeName(session.worktreePath) }
        : null;
    default:
      return null;
  }
}

export function resolveSessionMetaItems(
  properties: readonly SessionProperty[],
  source: SessionMetaSource,
) {
  return properties
    .map((property) => resolveMetaItem(property, source))
    .filter((item): item is SessionMetaItem => item !== null);
}
