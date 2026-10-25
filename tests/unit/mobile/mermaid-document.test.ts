import {
  mermaidDocument,
  parseMermaidMessage,
} from "@cocurdex/mobile/internal/markdown/mermaid-document";
import { describe, expect, it } from "vitest";

describe("mermaidDocument", () => {
  it("embeds the diagram source so it cannot close the script", () => {
    const html = mermaidDocument('graph TD\n  A["</script><b>"] --> B', "dark");
    expect(html.match(/<\/script>/g)).toHaveLength(2);
    expect(html).toContain("\\u003c/script>\\u003cb>");
    expect(html).toContain('"darkMode":true');
  });
});

describe("parseMermaidMessage", () => {
  it("accepts sizes and errors and ignores anything else", () => {
    expect(parseMermaidMessage('{"type":"size","height":120}')).toEqual({
      type: "size",
      height: 120,
    });
    expect(parseMermaidMessage('{"type":"error"}')).toEqual({ type: "error" });
    expect(parseMermaidMessage('{"type":"size","height":0}')).toBeNull();
    expect(parseMermaidMessage("not json")).toBeNull();
  });
});
