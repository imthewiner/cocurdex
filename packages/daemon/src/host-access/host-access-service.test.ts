import { createCocurdexDatabase } from "@cocurdex/db";
import { describe, expect, it } from "vitest";
import { HostAccessService } from "./host-access-service";

const local = { kind: "local" } as const;

async function setup() {
  const settings = new Map<string, string>();
  let now = new Date("2026-10-11T00:00:00.000Z");
  const service = new HostAccessService({
    localToken: "local-secret",
    repository: createCocurdexDatabase(":memory:").hostAccess,
    settings: {
      get: async (key) => settings.get(key) ?? null,
      set: async (key, value) => {
        settings.set(key, value);
      },
    },
    hostName: () => "studio",
    now: () => now,
  });
  await service.initialize();
  return {
    service,
    settings,
    advance(ms: number) {
      now = new Date(now.getTime() + ms);
    },
  };
}

describe("HostAccessService", () => {
  it("keeps a stable host id across restarts", async () => {
    const { service, settings } = await setup();
    const again = new HostAccessService({
      localToken: "x",
      repository: createCocurdexDatabase(":memory:").hostAccess,
      settings: {
        get: async (key) => settings.get(key) ?? null,
        set: async () => {
          throw new Error("must not rewrite the host id");
        },
      },
      hostName: () => "studio",
    });
    await again.initialize();

    expect(again.identity().hostId).toBe(service.identity().hostId);
  });

  it("resolves the local token to a full-access principal and rejects others", async () => {
    const { service } = await setup();

    expect(service.resolve("local-secret")).toEqual({ kind: "local" });
    expect(service.resolve("local-secreT")).toBeNull();
    expect(service.resolve("cocu_dev_unknown")).toBeNull();
    expect(service.resolve(undefined)).toBeNull();
  });

  it("exchanges a pairing code once for a device token with the pairing's scopes", async () => {
    const { service } = await setup();
    const { code } = service.createPairing(
      { label: "Phone", scopes: ["read", "approvals"] },
      local,
    );

    const first = service.exchangePairing({ code, label: "Pixel" }, "10.0.0.2");
    const second = service.exchangePairing({ code }, "10.0.0.2");

    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, reason: "consumed" });
    if (!first.ok) return;
    expect(first.result.scopes).toEqual(["read", "approvals"]);
    expect(service.resolve(first.result.token)).toEqual({
      kind: "device",
      deviceId: first.result.deviceId,
      scopes: ["read", "approvals"],
    });
    expect(service.listDevices()[0]?.label).toBe("Pixel");
    expect(service.listAudit(10).map((entry) => entry.action)).toEqual([
      "pairing.rejected",
      "pairing.exchanged",
      "pairing.created",
    ]);
  });

  it("rejects an expired pairing code", async () => {
    const { service, advance } = await setup();
    const { code } = service.createPairing(
      { label: "Phone", scopes: ["read"], ttlMinutes: 1 },
      local,
    );
    advance(61_000);

    expect(service.exchangePairing({ code }, null)).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("refuses to grant host administration or an empty scope set through pairing", async () => {
    const { service } = await setup();

    expect(() =>
      service.createPairing({ label: "x", scopes: ["host.admin"] }, local),
    ).toThrow(/host\.admin/);
    expect(() =>
      service.createPairing({ label: "x", scopes: [] }, local),
    ).toThrow();
    expect(() =>
      service.createPairing(
        { label: "x", scopes: ["read"], ttlMinutes: 61 },
        local,
      ),
    ).toThrow();
  });

  it("stops resolving a revoked device and notifies listeners", async () => {
    const { service } = await setup();
    const { code } = service.createPairing(
      { label: "Phone", scopes: ["read"] },
      local,
    );
    const exchanged = service.exchangePairing({ code }, null);
    if (!exchanged.ok) throw new Error("pairing failed");
    const revoked: string[] = [];
    service.onDeviceRevoked((deviceId) => revoked.push(deviceId));
    expect(service.resolve(exchanged.result.token)).not.toBeNull();

    service.revokeDevice(exchanged.result.deviceId, local);

    expect(service.resolve(exchanged.result.token)).toBeNull();
    expect(revoked).toEqual([exchanged.result.deviceId]);
  });

  it("defaults remote access to off and audits only enable/disable transitions", async () => {
    const { service } = await setup();

    expect(await service.readRemoteAccessSettings()).toEqual({
      enabled: false,
      port: 47_820,
    });
    await service.saveRemoteAccessSettings(
      { enabled: true, port: 50_000 },
      local,
    );
    await service.saveRemoteAccessSettings(
      { enabled: true, port: 50_001 },
      local,
    );
    await expect(
      service.saveRemoteAccessSettings({ enabled: true, port: 80 }, local),
    ).rejects.toThrow();

    expect(await service.readRemoteAccessSettings()).toEqual({
      enabled: true,
      port: 50_001,
    });
    expect(service.listAudit(10).map((entry) => entry.action)).toEqual([
      "remote.enabled",
    ]);
  });
});
