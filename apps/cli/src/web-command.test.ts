import { describe, expect, it } from "vitest";
import { buildWebClientUrl } from "./web-command";

describe("buildWebClientUrl", () => {
  it("keeps the token in the fragment so it never reaches the server", () => {
    const url = new URL(buildWebClientUrl("ws://127.0.0.1:53508", "a b+c"));
    expect(url.origin).toBe("http://127.0.0.1:53508");
    expect(url.pathname).toBe("/");
    expect(url.search).toBe("");
    expect(new URLSearchParams(url.hash.slice(1)).get("token")).toBe("a b+c");
  });
});
