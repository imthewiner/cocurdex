import {
  allowsMermaidNavigation,
  MERMAID_SCRIPT_URL,
  mermaidDocument,
  mermaidViewerDocument,
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

  it("lets a diagram load only the mermaid script and no other resource", () => {
    const html = mermaidDocument("graph TD\n  A --> B", "light");
    const policy = html.match(
      /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/,
    )?.[1];
    const directives = new Map(
      (policy ?? "").split(";").map((part) => {
        const [name = "", ...values] = part.trim().split(/\s+/);
        return [name, values];
      }),
    );
    expect(directives.get("default-src")).toEqual(["'none'"]);
    expect(directives.get("script-src")).toEqual([
      MERMAID_SCRIPT_URL,
      "'unsafe-inline'",
    ]);
    expect(directives.get("img-src")).toEqual(["data:", "blob:"]);
    expect(directives.has("connect-src")).toBe(false);
    expect(html.indexOf(policy ?? "")).toBeLessThan(
      html.indexOf(MERMAID_SCRIPT_URL, html.indexOf("</head>")),
    );
  });
});

describe("allowsMermaidNavigation", () => {
  it("keeps the diagram on its own document", () => {
    expect(allowsMermaidNavigation("about:blank")).toBe(true);
    expect(allowsMermaidNavigation("https://example.invalid/?q=secret")).toBe(
      false,
    );
    expect(allowsMermaidNavigation(MERMAID_SCRIPT_URL)).toBe(false);
  });
});

describe("mermaidViewerDocument", () => {
  it("shows the rendered diagram without running any script", () => {
    const html = mermaidViewerDocument("<svg></svg>", "#0a0a0a");
    expect(html).not.toContain("<script");
    expect(html).toContain("default-src 'none'");
    expect(html).not.toContain("script-src");
    expect(html).toContain("user-scalable=yes");
  });
});

describe("parseMermaidMessage", () => {
  it("accepts rendered diagrams and errors and ignores anything else", () => {
    expect(
      parseMermaidMessage(
        '{"type":"rendered","svg":"<svg/>","width":320,"height":120}',
      ),
    ).toEqual({ type: "rendered", svg: "<svg/>", width: 320, height: 120 });
    expect(parseMermaidMessage('{"type":"error"}')).toEqual({ type: "error" });
    expect(
      parseMermaidMessage(
        '{"type":"rendered","svg":"<svg/>","width":0,"height":120}',
      ),
    ).toBeNull();
    expect(
      parseMermaidMessage('{"type":"rendered","width":1,"height":1}'),
    ).toBeNull();
    expect(parseMermaidMessage("not json")).toBeNull();
  });
});
