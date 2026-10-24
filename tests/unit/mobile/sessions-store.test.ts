import {
  ATTENTION_REFRESH_DELAY_MS,
  createSessionsStore,
} from "@cocurdex/mobile/internal/sessions/sessions-store";
import type { CocurdexDaemonEvent, SessionRecord } from "@cocurdex/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calls, fakeConnection } from "./fake-connection";

const SESSION: SessionRecord = {
  id: "s1",
  workspaceId: "w1",
  title: "Draft release notes",
  agentType: "claude-agent",
  status: "idle",
  writeMode: "native-write",
  sessionModeId: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  lastMessageAt: null,
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createSessionsStore", () => {
  it("loads sessions, workspaces, and attention on first subscriber", async () => {
    const fake = fakeConnection({
      "workspace.list": [[{ id: "w1" }]],
      "session.list": [[SESSION]],
      "attention.list": [[]],
    });
    const store = createSessionsStore(fake.connection);

    expect(store.getSnapshot().loaded).toBe(false);
    store.subscribe(() => {});
    await vi.runAllTimersAsync();

    expect(store.getSnapshot()).toMatchObject({
      loaded: true,
      failed: false,
      sessions: [SESSION],
    });
  });

  it("applies session upserts and coalesces attention refreshes", async () => {
    const fake = fakeConnection({
      "workspace.list": [[]],
      "session.list": [[SESSION]],
      "attention.list": [[]],
    });
    const store = createSessionsStore(fake.connection);
    store.subscribe(() => {});
    await vi.runAllTimersAsync();
    const before = calls(fake.request, "attention.list");

    fake.emit({
      type: "session.upserted",
      sessionId: "s1",
      session: { ...SESSION, status: "running" },
    });
    fake.emit({
      type: "permission.requested",
      sessionId: "s1",
    } as CocurdexDaemonEvent);
    fake.emit({
      type: "session.title.updated",
      sessionId: "s1",
      title: "Release notes v2",
      expectedTitle: SESSION.title,
      updatedAt: "2026-10-02T00:00:00.000Z",
    });
    await vi.advanceTimersByTimeAsync(ATTENTION_REFRESH_DELAY_MS);

    expect(store.getSnapshot().sessions).toEqual([
      { ...SESSION, status: "running", title: "Release notes v2" },
    ]);
    expect(calls(fake.request, "attention.list") - before).toBe(1);
  });

  it("reloads everything after reconnecting and on an agent resync", async () => {
    const fake = fakeConnection({
      "workspace.list": [[]],
      "session.list": [[], [SESSION], [SESSION]],
      "attention.list": [[]],
    });
    const store = createSessionsStore(fake.connection);
    store.subscribe(() => {});
    await vi.runAllTimersAsync();

    fake.setStatus("live");
    await vi.runAllTimersAsync();
    expect(store.getSnapshot().sessions).toEqual([SESSION]);

    fake.emit({ type: "data.changed", areas: ["agent"] });
    await vi.runAllTimersAsync();
    expect(calls(fake.request, "session.list")).toBe(3);
  });

  it("reports a failed first load but keeps data from a later failure", async () => {
    const fake = fakeConnection({
      "workspace.list": [new Error("offline"), [], new Error("offline")],
      "session.list": [[SESSION]],
      "attention.list": [[]],
    });
    const store = createSessionsStore(fake.connection);
    store.subscribe(() => {});
    await vi.runAllTimersAsync();
    expect(store.getSnapshot()).toMatchObject({ loaded: false, failed: true });

    await store.reload();
    await store.reload();
    expect(store.getSnapshot()).toMatchObject({
      loaded: true,
      failed: false,
      sessions: [SESSION],
    });
  });

  it("stops listening when the last subscriber leaves", async () => {
    const fake = fakeConnection({
      "workspace.list": [[]],
      "session.list": [[]],
      "attention.list": [[]],
    });
    const store = createSessionsStore(fake.connection);
    const first = store.subscribe(() => {});
    const second = store.subscribe(() => {});
    await vi.runAllTimersAsync();

    first();
    expect(fake.listenerCount()).toBe(2);
    second();
    expect(fake.listenerCount()).toBe(0);
  });
});
