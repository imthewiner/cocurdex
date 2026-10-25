import {
  type NewSessionContext,
  resolveNewSession,
  resolveNewSessionDefaults,
} from "@cocurdex/daemon/internal/session-control/create-session";
import type {
  AgentDescriptor,
  AgentId,
  AgentPermissionMode,
  CompatibleProviderModel,
  SessionRecord,
} from "@cocurdex/shared";
import { describe, expect, it } from "vitest";

const now = "2026-10-25T00:00:00.000Z";

function agent(
  id: AgentId,
  permissionModes: AgentPermissionMode[],
  availability: AgentDescriptor["availability"] = "available",
): AgentDescriptor {
  return {
    id,
    label: `${id} label`,
    availability,
    capabilities: {
      sessionModes: [],
      permissionModes: permissionModes.map((mode) => ({
        id: mode,
        risk: "normal",
      })),
      writeModes: ["read-only"],
      supportsSteering: false,
      supportsStreaming: true,
      supportsSelections: false,
      sessionTitleStrategy: "app-generated",
      transport: "native",
    },
  };
}

function compatible(
  providerId: string,
  modelId: string,
): CompatibleProviderModel {
  return {
    provider: {
      id: providerId,
      name: providerId,
      baseUrl: `http://127.0.0.1:9/${providerId}`,
      enabled: true,
      apiKeySecretId: null,
      headersJson: null,
      createdAt: now,
      updatedAt: now,
    },
    model: {
      providerId,
      modelId,
      name: modelId,
      api: "anthropic-messages",
      enabled: true,
      source: "manual",
      capabilities: ["chat"],
      createdAt: now,
      updatedAt: now,
    },
  };
}

function previous(
  agentType: AgentId,
  extra: Partial<SessionRecord> = {},
): SessionRecord {
  return {
    id: `previous-${agentType}`,
    workspaceId: "workspace-1",
    title: "Earlier",
    agentType,
    status: "idle",
    writeMode: "read-only",
    sessionModeId: null,
    createdAt: now,
    updatedAt: now,
    lastMessageAt: now,
    ...extra,
  };
}

function context(
  overrides: Partial<NewSessionContext> = {},
): NewSessionContext {
  return {
    agents: [
      agent("codex", ["codex-auto"]),
      agent("claude-agent", ["claude-auto", "claude-default"]),
    ],
    workspaceSessions: [],
    compatibleModels: async (agentId) =>
      agentId === "claude-agent"
        ? [
            compatible("anthropic", "claude-sonnet"),
            compatible("anthropic", "claude-haiku-4"),
          ]
        : [compatible("openai", "gpt")],
    defaultModel: async () => null,
    ...overrides,
  };
}

describe("resolveNewSession", () => {
  it("continues with the agent, model, and permission mode used last in the workspace", async () => {
    const session = await resolveNewSession(
      { workspaceId: "workspace-1" },
      "new-1",
      context({
        workspaceSessions: [
          previous("claude-agent", {
            permissionMode: "claude-default",
            providerSnapshot: {
              providerId: "anthropic",
              providerName: "anthropic",
              modelId: "claude-sonnet",
              modelName: "claude-sonnet",
              api: "anthropic-messages",
              baseUrl: "",
            },
          }),
        ],
      }),
    );

    expect(session).toMatchObject({
      id: "new-1",
      agentType: "claude-agent",
      sessionKind: "main",
      writeMode: "native-write",
      permissionMode: "claude-default",
      providerSnapshot: {
        providerId: "anthropic",
        modelId: "claude-sonnet",
        baseUrl: "http://127.0.0.1:9/anthropic",
      },
    });
  });

  it("prefers the agent's default model over the last one used", async () => {
    const session = await resolveNewSession(
      { workspaceId: "workspace-1", agentType: "claude-agent" },
      "new-1",
      context({
        defaultModel: async () => ({
          providerId: "anthropic",
          modelId: "claude-haiku-4",
        }),
      }),
    );

    expect(session.providerSnapshot?.modelId).toBe("claude-haiku-4");
    expect(session.permissionMode).toBe("claude-default");
  });

  it("falls back to the first compatible model when nothing was used or set as default", async () => {
    const session = await resolveNewSession(
      { workspaceId: "workspace-1", agentType: "claude-agent" },
      "new-1",
      context({
        defaultModel: async () => ({
          providerId: "anthropic",
          modelId: "retired-model",
        }),
      }),
    );

    expect(session.providerSnapshot).toMatchObject({
      providerId: "anthropic",
      modelId: "claude-sonnet",
    });
  });

  it("refuses a model, agent, or permission mode the computer does not offer", async () => {
    const resolve = (input: Parameters<typeof resolveNewSession>[0]) =>
      resolveNewSession(
        input,
        "new-1",
        context({
          agents: [
            agent("codex", ["codex-auto"]),
            agent("claude-agent", ["claude-auto", "claude-default"]),
            agent("pi", [], "missing"),
          ],
        }),
      );

    await expect(
      resolve({
        workspaceId: "workspace-1",
        agentType: "codex",
        model: { providerId: "anthropic", modelId: "claude-sonnet" },
      }),
    ).rejects.toThrow(/not available for codex/);
    await expect(
      resolve({ workspaceId: "workspace-1", agentType: "pi" }),
    ).rejects.toThrow(/not available on this machine/);
    await expect(
      resolve({
        workspaceId: "workspace-1",
        agentType: "claude-agent",
        model: { providerId: "anthropic", modelId: "claude-haiku-4" },
        permissionMode: "claude-auto",
      }),
    ).rejects.toThrow(/not a permission mode/);
  });

  it("starts without a provider snapshot when the agent has no compatible model", async () => {
    const session = await resolveNewSession(
      { workspaceId: "workspace-1", agentType: "codex", title: "  Fix tax  " },
      "new-1",
      context({ compatibleModels: async () => [] }),
    );

    expect(session).toMatchObject({
      title: "Fix tax",
      providerSnapshot: null,
      permissionMode: "codex-auto",
    });
  });
});

describe("resolveNewSessionDefaults", () => {
  it("reports the choices a new session would get and the modes its model allows", async () => {
    const defaults = await resolveNewSessionDefaults(
      {
        workspaceId: "workspace-1",
        agentType: "claude-agent",
        model: { providerId: "anthropic", modelId: "claude-haiku-4" },
      },
      context(),
    );

    expect(defaults).toEqual({
      agentType: "claude-agent",
      model: {
        providerId: "anthropic",
        modelId: "claude-haiku-4",
        name: "claude-haiku-4",
      },
      permissionMode: "claude-default",
      permissionModes: ["claude-default"],
    });
  });
});
