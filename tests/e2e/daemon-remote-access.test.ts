import { readdir } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { requestDaemon } from "@cocurdex/daemon/client";
import {
  createDaemonRpcClient,
  createWebSocketTransport,
  daemonWebSocketProtocols,
} from "@cocurdex/rpc/client";
import {
  buildDaemonAttachmentUploadUrl,
  buildDaemonImageAttachmentUrl,
  HOST_PAIRING_HTTP_PATH,
  HOST_SESSION_HTTP_PATH,
  type HostAccessScope,
  type ImageAttachment,
} from "@cocurdex/shared";
import { afterEach, describe, expect, it } from "vitest";
import { type DaemonProcess, spawnDaemon } from "./helpers/daemon-process";

function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() =>
        typeof address === "object" && address
          ? resolve(address.port)
          : reject(new Error("No free port")),
      );
    });
  });
}

function remoteClient(port: number, token: string) {
  return createDaemonRpcClient(
    createWebSocketTransport(
      `ws://127.0.0.1:${port}`,
      daemonWebSocketProtocols(token),
    ),
    token,
  );
}

function exchange(port: number, body: unknown) {
  return fetch(`http://127.0.0.1:${port}${HOST_PAIRING_HTTP_PATH}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function checkSession(port: number, token: string) {
  return fetch(`http://127.0.0.1:${port}${HOST_SESSION_HTTP_PATH}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

async function enableRemoteAccess(daemon: DaemonProcess) {
  const port = await freePort();
  const status = await requestDaemon(
    "host.remoteAccess.set",
    { enabled: true, port },
    daemon.options,
  );
  expect(status).toMatchObject({ listening: true, error: null });
  return port;
}

async function pairDevice(
  daemon: DaemonProcess,
  port: number,
  scopes: HostAccessScope[] = ["read"],
) {
  const { code } = await requestDaemon(
    "host.pairing.create",
    { label: "Phone", scopes },
    daemon.options,
  );
  const response = await exchange(port, { code, label: "Pixel" });
  expect(response.status).toBe(200);
  return {
    code,
    paired: (await response.json()) as { token: string; deviceId: string },
  };
}

const daemons: DaemonProcess[] = [];

afterEach(async () => {
  for (const daemon of daemons.splice(0)) await daemon.dispose();
});

describe("remote host access", () => {
  it("keeps remote access off until enabled", async () => {
    const daemon = await spawnDaemon();
    daemons.push(daemon);

    const status = await requestDaemon("host.remoteAccess.get", daemon.options);

    expect(status).toMatchObject({
      settings: { enabled: false },
      listening: false,
      addresses: [],
    });
  });

  it("pairs a device once and limits it to the scopes it was granted", async () => {
    const daemon = await spawnDaemon();
    daemons.push(daemon);
    const port = await enableRemoteAccess(daemon);
    const { code, paired } = await pairDevice(daemon, port);

    const replay = await exchange(port, { code });
    expect(replay.status).toBe(401);

    const session = await checkSession(port, paired.token);
    expect(session.status).toBe(200);
    await expect(session.json()).resolves.toMatchObject({
      principal: { kind: "device", deviceId: paired.deviceId },
    });
    const client = remoteClient(port, paired.token);
    await expect(client.request("session.list", undefined)).resolves.toEqual(
      [],
    );
    await expect(
      client.request("host.session", undefined),
    ).resolves.toMatchObject({
      principal: {
        kind: "device",
        deviceId: paired.deviceId,
        scopes: ["read"],
      },
    });
    await expect(
      client.request("host.devices.list", undefined),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      client.request("session.stop", { sessionId: "missing" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const audit = await requestDaemon("host.audit.list", {}, daemon.options);
    expect(audit.map((entry) => entry.action)).toEqual(
      expect.arrayContaining([
        "remote.enabled",
        "pairing.created",
        "pairing.exchanged",
        "pairing.rejected",
      ]),
    );
  });

  it("streams image attachments to and from a device that may interact", async () => {
    const daemon = await spawnDaemon();
    daemons.push(daemon);
    const port = await enableRemoteAccess(daemon);
    const writer = await pairDevice(daemon, port, [
      "read",
      "files.read",
      "interact",
    ]);
    const reader = await pairDevice(daemon, port, ["read"]);
    const approver = await pairDevice(daemon, port, ["approvals"]);
    const webSocketUrl = `ws://127.0.0.1:${port}`;
    const gif = Buffer.from([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x04, 0x00, 0x05, 0x00, 0x00, 0x00,
      0x00,
    ]);
    const upload = (token: string) =>
      fetch(buildDaemonAttachmentUploadUrl(webSocketUrl, "image", "a.gif"), {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: gif,
      });

    expect((await upload(reader.paired.token)).status).toBe(403);
    await expect(
      readdir(path.join(daemon.userDataPath, "image-attachments")),
    ).rejects.toMatchObject({ code: "ENOENT" });

    const uploaded = await upload(writer.paired.token);
    expect(uploaded.status).toBe(201);
    const attachment = (await uploaded.json()) as ImageAttachment;
    expect(attachment).toMatchObject({ width: 4, height: 5, name: "a.gif" });

    const imageUrl = buildDaemonImageAttachmentUrl(
      webSocketUrl,
      attachment.filePath,
    );
    const denied = await fetch(imageUrl, {
      headers: { authorization: `Bearer ${approver.paired.token}` },
    });
    expect(denied.status).toBe(403);
    for (const device of [writer, reader]) {
      const read = await fetch(imageUrl, {
        headers: { authorization: `Bearer ${device.paired.token}` },
      });
      expect(read.status).toBe(200);
      expect(Buffer.from(await read.arrayBuffer())).toEqual(gif);
    }
  });

  it("refuses the local full-access token on the remote listener", async () => {
    const daemon = await spawnDaemon();
    daemons.push(daemon);
    const port = await enableRemoteAccess(daemon);

    expect((await checkSession(port, daemon.metadata.token)).status).toBe(401);
    await expect(
      remoteClient(port, daemon.metadata.token).request(
        "session.list",
        undefined,
      ),
    ).rejects.toMatchObject({ code: "TRANSPORT_ERROR" });
  });

  it("disconnects a device as soon as it is revoked", async () => {
    const daemon = await spawnDaemon();
    daemons.push(daemon);
    const port = await enableRemoteAccess(daemon);
    const { paired } = await pairDevice(daemon, port);
    const socket = new WebSocket(
      `ws://127.0.0.1:${port}`,
      daemonWebSocketProtocols(paired.token),
    );
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve());
      socket.addEventListener("error", () => reject(new Error("open failed")));
    });
    const closed = new Promise<void>((resolve) =>
      socket.addEventListener("close", () => resolve()),
    );
    socket.send(
      JSON.stringify({
        id: "1",
        method: "daemon.subscribe",
        params: {},
        token: paired.token,
      }),
    );

    await requestDaemon(
      "host.devices.revoke",
      { deviceId: paired.deviceId },
      daemon.options,
    );

    await closed;
    expect((await checkSession(port, paired.token)).status).toBe(401);
    await expect(
      remoteClient(port, paired.token).request("session.list", undefined),
    ).rejects.toMatchObject({ code: "TRANSPORT_ERROR" });
  });
});
