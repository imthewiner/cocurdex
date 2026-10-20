import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { validatePiMcpServerConfig } from "@cocurdex/agent-adapters/pi-mcp";
import {
  listMcpImportFiles,
  scanMcpImports,
} from "@cocurdex/daemon/internal/mcp-imports";
import { createTempDirs } from "@cocurdex/shared/testing";
import { afterAll, describe, expect, it } from "vitest";

const tempDirs = createTempDirs();

afterAll(() => tempDirs.cleanup());

async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value));
}

describe("scanMcpImports", () => {
  it("reads other agents' configs and compares them with Pi's", async () => {
    const home = await tempDirs.create("cocurdex-mcp-home-");
    const workspace = await tempDirs.create("cocurdex-mcp-ws-");
    await writeJson(path.join(home, ".claude.json"), {
      projects: {},
      mcpServers: {
        github: {
          type: "http",
          url: "https://api.example.invalid/mcp",
          headers: { Authorization: "Bearer ${GITHUB_TOKEN}" },
        },
        legacy: { type: "sse", url: "https://example.invalid/sse" },
      },
    });
    await writeJson(path.join(workspace, ".mcp.json"), {
      mcpServers: { postgres: { command: "npx", args: ["pg-mcp"] } },
    });
    await writeJson(path.join(home, ".cursor", "mcp.json"), {
      mcpServers: { figma: { url: "https://figma.example.invalid/mcp" } },
    });
    await writeJson(path.join(home, ".gemini", "config", "mcp_config.json"), {
      mcpServers: {
        linear: {
          serverUrl: "https://linear.example.invalid/mcp",
          disabled: true,
        },
      },
    });
    await writeFile(path.join(home, ".cursor", "broken.json"), "{");

    const candidates = await scanMcpImports({
      files: listMcpImportFiles(home, workspace),
      current: {
        postgres: { command: "npx", args: ["pg-mcp"], enabled: false },
        figma: { url: "https://other.example.invalid/mcp" },
      },
      validate: validatePiMcpServerConfig,
    });

    const byName = Object.fromEntries(
      candidates.map((candidate) => [candidate.name, candidate]),
    );
    expect(candidates.map((candidate) => candidate.source)).toEqual([
      "claude",
      "claude",
      "claude-project",
      "cursor",
      "antigravity",
    ]);
    expect(byName.github).toMatchObject({ match: "new", unsupported: null });
    expect(byName.legacy.unsupported).toContain("SSE");
    expect(byName.postgres.match).toBe("same");
    expect(byName.figma.match).toBe("different");
    expect(byName.linear).toMatchObject({
      config: { url: "https://linear.example.invalid/mcp", enabled: false },
      disabledInSource: true,
      unsupported: null,
    });
  });

  it("skips the project file when no workspace is given", () => {
    const sources = listMcpImportFiles("/home", null).map(
      (file) => file.source,
    );
    expect(sources).toEqual(["claude", "cursor", "antigravity"]);
  });
});
