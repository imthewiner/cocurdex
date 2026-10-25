import {
  type AgentDescriptor,
  type AgentId,
  type AgentPermissionMode,
  type CompatibleProviderModel,
  type CreateSessionPayload,
  createProviderSnapshotForModel,
  isAcpRegistryAgentId,
  isAgentPermissionModeSupportedForModel,
  type NewSessionDefaults,
  type SessionConfiguration,
  type SessionRecord,
} from "@cocurdex/shared";

export interface NewSessionContext {
  agents: readonly AgentDescriptor[];
  workspaceSessions: readonly SessionRecord[];
  compatibleModels(agentId: AgentId): Promise<CompatibleProviderModel[]>;
  defaultModel(
    agentId: AgentId,
  ): Promise<{ providerId: string; modelId: string } | null>;
}

function writeModeForAgent(agentId: AgentId): SessionRecord["writeMode"] {
  return isAcpRegistryAgentId(agentId) || agentId === "claude-agent"
    ? "native-write"
    : "read-only";
}

function resolveAgent(
  requested: AgentId | undefined,
  { agents, workspaceSessions }: NewSessionContext,
) {
  const available = agents.filter(
    (agent) => agent.availability === "available",
  );
  const pick = (id: AgentId | undefined) =>
    id ? available.find((agent) => agent.id === id) : undefined;
  if (requested) {
    const agent = pick(requested);
    if (!agent)
      throw new Error(`${requested} is not available on this machine`);
    return agent;
  }
  const agent = pick(workspaceSessions[0]?.agentType) ?? available[0];
  if (!agent) throw new Error("No agent is available on this machine");
  return agent;
}

async function resolveModel(
  agentId: AgentId,
  requested: CreateSessionPayload["model"],
  context: NewSessionContext,
) {
  const models = await context.compatibleModels(agentId);
  const find = (selection: { providerId: string; modelId: string } | null) =>
    selection
      ? models.find(
          (item) =>
            item.provider.id === selection.providerId &&
            item.model.modelId === selection.modelId,
        )
      : undefined;
  if (requested) {
    const model = find(requested);
    if (!model) {
      throw new Error(
        `${requested.providerId}/${requested.modelId} is not available for ${agentId}`,
      );
    }
    return model;
  }
  const recent = context.workspaceSessions.find(
    (session) => session.agentType === agentId && session.providerSnapshot,
  )?.providerSnapshot;
  return (
    find(await context.defaultModel(agentId)) ??
    find(
      recent
        ? { providerId: recent.providerId, modelId: recent.modelId }
        : null,
    ) ??
    models[0] ??
    null
  );
}

function allowedPermissionModes(
  agent: AgentDescriptor,
  model: CompatibleProviderModel | null,
) {
  return agent.capabilities.permissionModes
    .map((option) => option.id)
    .filter((mode) =>
      isAgentPermissionModeSupportedForModel(
        agent.id,
        mode,
        model?.model.modelId,
        model?.model.name,
      ),
    );
}

function resolvePermissionMode(
  agent: AgentDescriptor,
  requested: AgentPermissionMode | null | undefined,
  allowed: readonly AgentPermissionMode[],
  workspaceSessions: readonly SessionRecord[],
) {
  if (requested) {
    if (!allowed.includes(requested)) {
      throw new Error(`${requested} is not a permission mode of ${agent.id}`);
    }
    return requested;
  }
  const recent = workspaceSessions.find(
    (session) => session.agentType === agent.id && session.permissionMode,
  )?.permissionMode;
  if (recent && allowed.includes(recent)) return recent;
  return allowed[0];
}

async function resolveChoices(
  input: CreateSessionPayload,
  context: NewSessionContext,
) {
  const agent = resolveAgent(input.agentType, context);
  const model = await resolveModel(agent.id, input.model, context);
  const permissionModes = allowedPermissionModes(agent, model);
  const permissionMode = resolvePermissionMode(
    agent,
    input.permissionMode,
    permissionModes,
    context.workspaceSessions,
  );
  return { agent, model, permissionModes, permissionMode };
}

export async function resolveNewSessionDefaults(
  input: CreateSessionPayload,
  context: NewSessionContext,
): Promise<NewSessionDefaults> {
  const { agent, model, permissionModes, permissionMode } =
    await resolveChoices(input, context);
  return {
    agentType: agent.id,
    model: model
      ? {
          providerId: model.provider.id,
          modelId: model.model.modelId,
          name: model.model.name,
        }
      : null,
    permissionMode: permissionMode ?? null,
    permissionModes,
  };
}

export async function resolveNewSession(
  input: CreateSessionPayload,
  id: string,
  context: NewSessionContext,
): Promise<SessionConfiguration> {
  const { agent, model, permissionMode } = await resolveChoices(input, context);
  return {
    id,
    workspaceId: input.workspaceId,
    title: input.title?.trim() || agent.label,
    agentType: agent.id,
    sessionKind: "main",
    writeMode: writeModeForAgent(agent.id),
    sessionModeId: null,
    permissionMode,
    agentRoleId: null,
    providerSnapshot: model ? createProviderSnapshotForModel(model) : null,
    worktreePath: null,
  };
}
