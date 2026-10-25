import {
  chooseAgent,
  chooseModel,
  choosePermissionMode,
  chooseWorkspace,
  draftWorkspaceId,
  EMPTY_DRAFT,
  workspaceChoices,
} from "@cocurdex/mobile/internal/new-session/new-session-draft";
import {
  CHAT_WORKSPACE_ID,
  type SessionRecord,
  type WorkspaceRecord,
} from "@cocurdex/shared";
import { describe, expect, it } from "vitest";

const now = "2026-10-25T00:00:00.000Z";

function workspace(id: string): WorkspaceRecord {
  return {
    id,
    name: id,
    rootPaths: [`/synthetic/${id}`],
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    sortOrder: 0,
  };
}

function session(
  id: string,
  workspaceId: string,
  lastMessageAt: string,
  extra: Partial<SessionRecord> = {},
): SessionRecord {
  return {
    id,
    workspaceId,
    title: id,
    agentType: "codex",
    status: "idle",
    writeMode: "read-only",
    sessionModeId: null,
    createdAt: now,
    updatedAt: now,
    lastMessageAt,
    ...extra,
  };
}

describe("workspaceChoices", () => {
  it("lists project workspaces by latest activity with their session counts", () => {
    const choices = workspaceChoices(
      [
        workspace("docs"),
        workspace("shop"),
        workspace(CHAT_WORKSPACE_ID),
        workspace("tokens"),
      ],
      [
        session("a", "shop", "2026-10-24T10:00:00.000Z"),
        session("b", "shop", "2026-10-20T10:00:00.000Z"),
        session("c", "docs", "2026-10-22T10:00:00.000Z"),
        session("d", "docs", "2026-10-25T10:00:00.000Z", {
          archivedAt: now,
        }),
        session("e", "docs", "2026-10-25T11:00:00.000Z", {
          parentSessionId: "c",
        }),
      ],
    );

    expect(
      choices.map((choice) => [choice.workspace.id, choice.sessionCount]),
    ).toEqual([
      ["shop", 2],
      ["docs", 1],
      ["tokens", 0],
    ]);
    expect(draftWorkspaceId(EMPTY_DRAFT, choices)).toBe("shop");
    expect(
      draftWorkspaceId(chooseWorkspace(EMPTY_DRAFT, "docs"), choices),
    ).toBe("docs");
    expect(
      draftWorkspaceId(chooseWorkspace(EMPTY_DRAFT, "removed"), choices),
    ).toBe("shop");
  });
});

describe("draft choices", () => {
  it("drops the model and mode picked for another agent", () => {
    const draft = choosePermissionMode(
      chooseModel(chooseWorkspace(EMPTY_DRAFT, "shop"), "claude-agent", {
        providerId: "anthropic",
        modelId: "opus",
      }),
      "claude-agent",
      "claude-plan",
    );

    expect(chooseAgent(draft, "claude-agent")).toBe(draft);
    expect(chooseAgent(draft, "codex")).toEqual({
      workspaceId: "shop",
      agentType: "codex",
    });
  });

  it("lets the computer pick the mode again after a model change", () => {
    const draft = choosePermissionMode(
      chooseWorkspace(EMPTY_DRAFT, "shop"),
      "claude-agent",
      "claude-auto",
    );

    expect(
      chooseModel(draft, "claude-agent", {
        providerId: "anthropic",
        modelId: "haiku",
      }),
    ).toEqual({
      workspaceId: "shop",
      agentType: "claude-agent",
      model: { providerId: "anthropic", modelId: "haiku" },
    });
  });
});
