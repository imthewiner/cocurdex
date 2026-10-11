import type { CocurdexDaemonEvent, DaemonEventMeta } from "@cocurdex/shared";
import { describe, expect, it, vi } from "vitest";

type EmitEvent = (event: CocurdexDaemonEvent, meta: DaemonEventMeta) => void;

const emitters = vi.hoisted(() => [] as EmitEvent[]);
vi.mock("../../lib/daemon-client", () => ({
  subscribeDaemon: vi.fn(async (onEvent: EmitEvent) => {
    emitters.push(onEvent);
    return {
      close: vi.fn(),
      epoch: "epoch-a",
      lastSeq: null,
      replayGap: false,
    };
  }),
}));

const { daemonEventApi, onDaemonAgentEvent } = await import(
  "../../lib/daemon-events"
);

const meta = { epoch: "epoch-a", seq: 7 };

describe("daemon events", () => {
  it("routes daemon events to product and agent listeners over one subscription", async () => {
    const agent = vi.fn();
    const data = vi.fn();
    const searchDone = vi.fn();
    const files = vi.fn();
    onDaemonAgentEvent(agent);
    daemonEventApi.onDataChanged(data);
    daemonEventApi.onWorkspaceSearchDone(searchDone);
    daemonEventApi.onWorkspaceFilesChanged(files);
    await vi.waitFor(() => expect(emitters).toHaveLength(1));
    const emit = emitters[0] as EmitEvent;

    emit({ type: "data.changed", areas: ["issues"] }, meta);
    emit({ type: "search.done", searchId: "s1", reason: "completed" }, meta);
    emit({ type: "workspace.filesChanged", rootPath: "/repo" }, meta);
    emit({ type: "team.changed", teamId: "t1" } as CocurdexDaemonEvent, meta);
    emit(
      {
        type: "state.changed",
        sessionId: "s1",
        status: "idle",
      } as CocurdexDaemonEvent,
      meta,
    );

    expect(data).toHaveBeenCalledWith({
      type: "data.changed",
      areas: ["issues"],
    });
    expect(searchDone).toHaveBeenCalledWith({
      searchId: "s1",
      reason: "completed",
    });
    expect(files).toHaveBeenCalledWith({ rootPath: "/repo" });
    expect(agent).toHaveBeenCalledOnce();
    expect(agent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "state.changed" }),
      meta,
    );
  });

  it("stops delivering to a listener after it unsubscribes", async () => {
    const data = vi.fn();
    const unsubscribe = daemonEventApi.onDataChanged(data);
    unsubscribe();
    (emitters[0] as EmitEvent)(
      { type: "data.changed", areas: ["notes"] },
      meta,
    );
    expect(data).not.toHaveBeenCalled();
    expect(emitters).toHaveLength(1);
  });
});
