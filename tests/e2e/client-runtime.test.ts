import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  createHostConnection,
  type HostConnection,
} from "@cocurdex/client-runtime";
import { readDaemonMetadata } from "@cocurdex/daemon/client";
import type { CocurdexDaemonEvent } from "@cocurdex/shared";
import { afterEach, describe, expect, it } from "vitest";
import {
  type DaemonProcess,
  spawnDaemon,
  waitFor,
} from "./helpers/daemon-process";

const hosts: HostConnection[] = [];
const daemons: DaemonProcess[] = [];

afterEach(async () => {
  for (const host of hosts.splice(0)) host.dispose();
  for (const daemon of daemons.splice(0)) await daemon.dispose();
});

function connectHost(userDataPath: string) {
  const host = createHostConnection({
    hostId: "local",
    platform: {
      async resolveEndpoint() {
        const { webSocketUrl, token } = await readDaemonMetadata(userDataPath);
        return { webSocketUrl, token };
      },
    },
    supervisor: { backoff: { baseMs: 100, maxMs: 500 } },
  });
  hosts.push(host);
  return host;
}

async function start(userDataPath: string) {
  const daemon = await spawnDaemon({ userDataPath });
  daemons.push(daemon);
  return daemon;
}

describe("client runtime against a real daemon", () => {
  it("streams events and requests over one host connection", async () => {
    const daemon = await start(
      mkdtempSync(path.join(tmpdir(), "cocurdex-e2e-host-")),
    );
    const host = connectHost(daemon.userDataPath);
    const events: CocurdexDaemonEvent[] = [];
    host.onEvent((event) => events.push(event));
    await waitFor(() => host.getState().status === "live");
    expect(host.getState().epoch).toBe(daemon.metadata.startedAt);

    await host.request("note.create", { title: "from host" });
    await waitFor(() =>
      events.some(
        (event) =>
          event.type === "data.changed" && event.areas.includes("notes"),
      ),
    );
    expect((await host.request("note.list")).map((note) => note.title)).toEqual(
      ["from host"],
    );
  });

  it("reconnects across a daemon restart and asks clients to resync", async () => {
    const userDataPath = mkdtempSync(
      path.join(tmpdir(), "cocurdex-e2e-host-restart-"),
    );
    const first = await start(userDataPath);
    const host = connectHost(userDataPath);
    const events: CocurdexDaemonEvent[] = [];
    host.onEvent((event) => events.push(event));
    await waitFor(() => host.getState().status === "live");
    await host.request("note.create", { title: "before restart" });
    await waitFor(() => host.getState().lastSeq !== null);
    const firstEpoch = host.getState().epoch;

    expect(await first.stop()).toBe(0);
    await waitFor(() => host.getState().status !== "live");
    const pending = host.command("note.list", undefined, {
      idempotencyKey: "list-across-restart",
    });

    events.length = 0;
    const second = await start(userDataPath);
    await waitFor(() => host.getState().status === "live", 15_000);
    expect(host.getState().epoch).toBe(second.metadata.startedAt);
    expect(host.getState().epoch).not.toBe(firstEpoch);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "data.changed",
        areas: expect.arrayContaining(["notes", "agent"]),
      }),
    );
    expect((await pending).map((note) => note.title)).toEqual([
      "before restart",
    ]);
  });
});
