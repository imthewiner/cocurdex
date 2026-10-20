import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  type McpImportCandidate,
  type McpImportSource,
  type McpServerConfig,
  normalizeImportedMcpServer,
  sameMcpServerConfig,
} from "@cocurdex/shared";

interface McpImportFile {
  source: McpImportSource;
  path: string;
}

export function listMcpImportFiles(
  homeDir: string,
  workspaceRootPath: string | null,
): McpImportFile[] {
  const files: McpImportFile[] = [
    { source: "claude", path: path.join(homeDir, ".claude.json") },
    { source: "cursor", path: path.join(homeDir, ".cursor", "mcp.json") },
    {
      source: "antigravity",
      path: path.join(homeDir, ".gemini", "config", "mcp_config.json"),
    },
  ];
  if (workspaceRootPath) {
    files.splice(1, 0, {
      source: "claude-project",
      path: path.join(workspaceRootPath, ".mcp.json"),
    });
  }
  return files;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readServers(filePath: string) {
  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }
  if (!isRecord(parsed) || !isRecord(parsed.mcpServers)) return [];
  return Object.entries(parsed.mcpServers).filter(
    (entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]),
  );
}

export async function scanMcpImports(options: {
  files: McpImportFile[];
  current: Record<string, McpServerConfig>;
  validate(name: string, config: McpServerConfig): Promise<string | null>;
}): Promise<McpImportCandidate[]> {
  const perFile = await Promise.all(
    options.files.map(async (file) => {
      const servers = await readServers(file.path);
      return Promise.all(
        servers.map(async ([name, raw]): Promise<McpImportCandidate> => {
          const config = normalizeImportedMcpServer(raw);
          const existing = options.current[name];
          let match: McpImportCandidate["match"] = "new";
          if (existing) {
            match = sameMcpServerConfig(existing, config)
              ? "same"
              : "different";
          }
          return {
            source: file.source,
            sourcePath: file.path,
            name,
            config,
            match,
            disabledInSource: raw.disabled === true || raw.enabled === false,
            unsupported: await options.validate(name, config),
          };
        }),
      );
    }),
  );
  return perFile.flat();
}
