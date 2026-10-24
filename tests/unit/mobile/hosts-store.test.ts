import type { KeyValueStorage } from "@cocurdex/client-runtime";
import { createHostsStore } from "@cocurdex/mobile/internal/hosts/hosts-store";
import { describe, expect, it, vi } from "vitest";

const LINK = "http://192.168.1.20:47820/#pair=K7-2Q";

function memoryStorage(): KeyValueStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

function hostAnswering(status: number, body: unknown = {}) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
  ) as unknown as typeof fetch;
}

const PAIRED = {
  host: { hostId: "host-1", name: "Studio Mac" },
  deviceId: "device-1",
  token: "token-1",
  scopes: ["read", "interact"],
};

describe("createHostsStore", () => {
  it("pairs from a link, saves the host, and notifies subscribers", async () => {
    const storage = memoryStorage();
    const hosts = createHostsStore(storage);
    const listener = vi.fn();
    hosts.subscribe(listener);
    const fetchImpl = hostAnswering(200, PAIRED);

    const result = await hosts.pair(LINK, "Pocket", fetchImpl);

    expect(result).toMatchObject({ host: { hostId: "host-1" } });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://192.168.1.20:47820/api/pair",
      expect.objectContaining({
        body: JSON.stringify({ code: "K7-2Q", label: "Pocket" }),
      }),
    );
    expect(listener).toHaveBeenCalledOnce();
    expect(hosts.getSnapshot()).toEqual([
      expect.objectContaining({
        hostId: "host-1",
        baseUrl: "http://192.168.1.20:47820",
      }),
    ]);
    expect(createHostsStore(storage).getSnapshot()).toHaveLength(1);
  });

  it("reports a malformed link without calling the host", async () => {
    const fetchImpl = hostAnswering(200, PAIRED);
    const hosts = createHostsStore(memoryStorage());

    await expect(
      hosts.pair("192.168.1.20", "Pocket", fetchImpl),
    ).resolves.toEqual({ failure: "link" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports a rejected code and keeps nothing", async () => {
    const hosts = createHostsStore(memoryStorage());

    await expect(
      hosts.pair(LINK, "Pocket", hostAnswering(401)),
    ).resolves.toEqual({ failure: "invalid" });
    expect(hosts.getSnapshot()).toEqual([]);
  });

  it("forgets a removed host", async () => {
    const hosts = createHostsStore(memoryStorage());
    await hosts.pair(LINK, "Pocket", hostAnswering(200, PAIRED));

    hosts.remove("host-1");

    expect(hosts.getSnapshot()).toEqual([]);
  });
});
