import { supportsInSessionRuntimeAxis } from "../agent-runtime-capabilities";
import type {
  AgentId,
  AgentProviderSnapshot,
  AgentThinkingLevel,
  ReasoningEffort,
} from "../contracts";

export interface SessionRuntimeSelection {
  reasoningEffort?: ReasoningEffort | null;
  serviceTier?: string | null;
  fastMode?: boolean | null;
  thinkingLevel?: AgentThinkingLevel | null;
  openCodeAgent?: string | null;
  openCodeVariant?: string | null;
}

export function applySessionRuntime(
  snapshot: AgentProviderSnapshot,
  agentId: AgentId,
  supportsFastMode: boolean,
  runtime: SessionRuntimeSelection,
): AgentProviderSnapshot {
  const thinkingLevel =
    runtime.thinkingLevel === "default" ? null : runtime.thinkingLevel;
  return {
    ...snapshot,
    thinkingLevel: thinkingLevel ?? null,
    ...(agentId === "codex"
      ? { reasoningEffort: runtime.reasoningEffort ?? null }
      : {}),
    ...(agentId === "claude-agent" && supportsFastMode
      ? { fastMode: runtime.fastMode ?? false }
      : {}),
    ...(supportsInSessionRuntimeAxis(agentId, "speed")
      ? { serviceTier: runtime.serviceTier ?? null }
      : {}),
    ...(agentId === "opencode"
      ? {
          openCodeAgent: runtime.openCodeAgent ?? null,
          openCodeVariant: runtime.openCodeVariant ?? null,
        }
      : {}),
  };
}
