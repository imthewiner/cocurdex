export interface WorkspaceEntry {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: WorkspaceEntry[];
}

export interface WorkspaceFileRecord {
  kind: "directory" | "file";
  name: string;
  path: string;
  relativePath: string;
}

export interface McpConfigFile {
  path: string;
  content: string;
}

export function isValidMcpServerName(name: string) {
  return /^[A-Za-z0-9_-]+$/.test(name);
}

export function pathBaseName(value: string): string {
  const segments = value.split(/[\\/]+/).filter(Boolean);
  return segments.at(-1) ?? value;
}

export const DAEMON_PDF_HTTP_PATH = "/files/pdf";
export const DAEMON_PDF_PATH_QUERY = "path";

export function buildDaemonPdfUrl(webSocketUrl: string, filePath: string) {
  const url = new URL(DAEMON_PDF_HTTP_PATH, webSocketUrl);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  url.searchParams.set(DAEMON_PDF_PATH_QUERY, filePath);
  return url.toString();
}
