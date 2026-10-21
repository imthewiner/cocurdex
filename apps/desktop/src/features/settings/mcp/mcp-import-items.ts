import {
  isValidMcpServerName,
  type McpImportCandidate,
  type McpImportMatch,
  type McpImportSource,
  type McpServerConfig,
  parseMcpServersJson,
  sameMcpServerConfig,
} from "@cocurdex/shared";

export interface McpImportItem {
  key: string;
  name: string;
  config: McpServerConfig;
  source: string;
  match: McpImportMatch;
  unsupported: string | null;
}

export function defaultImportSelection(items: McpImportItem[]) {
  const picked: string[] = [];
  const names = new Set<string>();
  for (const item of items) {
    if (item.match !== "new" || item.unsupported || names.has(item.name)) {
      continue;
    }
    picked.push(item.key);
    names.add(item.name);
  }
  return picked;
}

export type McpImportAgent = Exclude<McpImportSource, "claude-project">;

export interface McpImportAgentSummary {
  count: number;
  agents: McpImportAgent[];
}

function importAgent(source: McpImportSource): McpImportAgent {
  return source === "claude-project" ? "claude" : source;
}

export function importableAgentSummary(
  candidates: McpImportCandidate[],
): McpImportAgentSummary {
  const names = new Set<string>();
  const agents: McpImportAgent[] = [];
  for (const candidate of candidates) {
    if (candidate.match !== "new" || candidate.unsupported) continue;
    names.add(candidate.name);
    const agent = importAgent(candidate.source);
    if (!agents.includes(agent)) agents.push(agent);
  }
  return { count: names.size, agents };
}

export function importItemsFromCandidates(
  candidates: McpImportCandidate[],
  sourceLabel: (candidate: McpImportCandidate) => string,
): McpImportItem[] {
  return candidates.map((candidate) => ({
    key: `${candidate.source}:${candidate.name}`,
    name: candidate.name,
    config: candidate.config,
    source: sourceLabel(candidate),
    match: candidate.match,
    unsupported: candidate.unsupported,
  }));
}

function matchExisting(
  existing: McpServerConfig | undefined,
  config: McpServerConfig,
): McpImportMatch {
  if (!existing) return "new";
  return sameMcpServerConfig(existing, config) ? "same" : "different";
}

export function importItemsFromJson(
  text: string,
  current: Record<string, McpServerConfig>,
  messages: { source: string; invalidName: string },
): McpImportItem[] {
  return Object.entries(parseMcpServersJson(text)).map(([name, config]) => ({
    key: `json:${name}`,
    name,
    config,
    source: messages.source,
    match: matchExisting(current[name], config),
    unsupported: isValidMcpServerName(name) ? null : messages.invalidName,
  }));
}
