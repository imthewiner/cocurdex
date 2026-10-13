import { buildLocalWebClientUrl } from "@cocurdex/shared/internal/host-access";
import { describe, expect, it } from "vitest";

describe("buildLocalWebClientUrl", () => {
  it("keeps the token in the fragment so it never reaches the server", () => {
    const url = new URL(
      buildLocalWebClientUrl("ws://127.0.0.1:53508", "a b+c"),
    );
    expect(url.origin).toBe("http://127.0.0.1:53508");
    expect(url.pathname).toBe("/");
    expect(url.search).toBe("");
    expect(new URLSearchParams(url.hash.slice(1)).get("token")).toBe("a b+c");
  });

  it("serves over https when the daemon socket is secure", () => {
    const url = new URL(buildLocalWebClientUrl("wss://host.local:443", "t"));
    expect(url.protocol).toBe("https:");
  });
});
