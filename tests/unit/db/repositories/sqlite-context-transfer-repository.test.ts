import { DatabaseSync } from "node:sqlite";
import { initializeDatabase } from "@cocurdex/db/internal/migrations";
import { createSqliteContextTransferRepository } from "@cocurdex/db/internal/repositories/sqlite-context-transfer-repository";
import type { ContextTransferRecord } from "@cocurdex/shared";
import { describe, expect, it } from "vitest";

const now = "2026-10-12T00:00:00.000Z";

function createRepository() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  initializeDatabase(database);
  database.exec(`
    INSERT INTO workspaces (id, name, root_paths, created_at, updated_at, last_opened_at)
    VALUES ('w1', 'Repo', '["/repo"]', '${now}', '${now}', '${now}');
    INSERT INTO sessions (id, workspace_id, title, agent_type, status, write_mode, created_at, updated_at)
    VALUES ('fork', 'w1', 'Fork', 'codex', 'idle', 'read-only', '${now}', '${now}');
  `);
  return createSqliteContextTransferRepository(database);
}

function transfer(
  id: string,
  kind: ContextTransferRecord["kind"],
): ContextTransferRecord {
  return {
    id,
    kind,
    sourceSessionId: kind === "fork" ? "source" : "fork",
    targetSessionId: "fork",
    sourceMessageId: "m0",
    sourceAgentTypes: ["pi"],
    targetAgentType: null,
    status: "pending",
    strategy: null,
    coveredMessageCount: 0,
    handoffText: null,
    consumedByMessageId: null,
    createdAt: now,
    consumedAt: null,
  };
}

const consumption = (messageId: string) => ({
  targetAgentType: "codex" as const,
  sourceAgentTypes: ["pi" as const],
  strategy: "full" as const,
  coveredMessageCount: 2,
  handoffText: "<cocurdex_context_handoff>",
  consumedByMessageId: messageId,
  consumedAt: now,
});

describe("createSqliteContextTransferRepository", () => {
  it("reopens a fork and drops switches consumed by rewound messages", () => {
    const repository = createRepository();
    repository.insert(transfer("t-fork", "fork"));
    expect(repository.findPending("fork")?.id).toBe("t-fork");
    repository.consume("t-fork", consumption("m1"));
    repository.insert({
      ...transfer("t-switch", "agent_switch"),
      ...consumption("m2"),
      status: "consumed",
    });
    repository.insert({
      ...transfer("t-kept", "agent_switch"),
      ...consumption("m9"),
      status: "consumed",
    });
    expect(repository.findPending("fork")).toBeNull();

    repository.reopenConsumedBy("fork", ["m1", "m2"]);

    expect(
      repository
        .listByTargetSession("fork")
        .map(({ id, status, handoffText }) => ({ id, status, handoffText })),
    ).toEqual([
      { id: "t-fork", status: "pending", handoffText: null },
      {
        id: "t-kept",
        status: "consumed",
        handoffText: "<cocurdex_context_handoff>",
      },
    ]);
  });
});
