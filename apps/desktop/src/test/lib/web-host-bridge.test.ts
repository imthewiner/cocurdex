import { describe, expect, it } from "vitest";
import { resolveWebDaemonConnection } from "../../lib/web-host-bridge";

function memoryStore() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

const page = { host: "127.0.0.1:53508", protocol: "http:" };

describe("resolveWebDaemonConnection", () => {
  it("connects to the serving daemon with the fragment token and remembers it for reloads", () => {
    const store = memoryStore();
    expect(
      resolveWebDaemonConnection({ ...page, hash: "#token=abc" }, store),
    ).toEqual({ token: "abc", webSocketUrl: "ws://127.0.0.1:53508" });
    expect(resolveWebDaemonConnection({ ...page, hash: "" }, store)).toEqual({
      token: "abc",
      webSocketUrl: "ws://127.0.0.1:53508",
    });
  });

  it("prefers a fresh fragment token after a daemon restart", () => {
    const store = memoryStore();
    resolveWebDaemonConnection({ ...page, hash: "#token=old" }, store);
    expect(
      resolveWebDaemonConnection({ ...page, hash: "#token=new" }, store)?.token,
    ).toBe("new");
  });

  it("uses wss behind https and reports no connection without a token", () => {
    expect(
      resolveWebDaemonConnection(
        { host: "example.test", protocol: "https:", hash: "#token=t" },
        null,
      )?.webSocketUrl,
    ).toBe("wss://example.test");
    expect(resolveWebDaemonConnection({ ...page, hash: "" }, null)).toBeNull();
  });
});
