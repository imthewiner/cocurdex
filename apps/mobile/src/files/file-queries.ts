import { type SavedHost, savedHostEndpoint } from "@cocurdex/client-runtime";
import { buildDaemonFileUrl } from "@cocurdex/shared";
import useSWR from "swr";
import { hostConnection } from "@/connection";
import { MAX_PREVIEW_BYTES, readFileContent } from "./file-content";

export function workspaceFileSource(
  host: Pick<SavedHost, "baseUrl" | "token">,
  filePath: string,
) {
  const { webSocketUrl, token } = savedHostEndpoint(host);
  return {
    uri: buildDaemonFileUrl(webSocketUrl, filePath),
    headers: { Authorization: `Bearer ${token}` },
  };
}

async function fetchFileContent(host: SavedHost, filePath: string) {
  const source = workspaceFileSource(host, filePath);
  const response = await fetch(source.uri, {
    headers: { ...source.headers, Range: `bytes=0-${MAX_PREVIEW_BYTES - 1}` },
  });
  return readFileContent(
    response.status,
    response.headers.get("content-range"),
    await response.text(),
  );
}

export function useFileContent(host: SavedHost, filePath: string) {
  return useSWR(
    ["files.raw", host.hostId, filePath] as const,
    () => fetchFileContent(host, filePath),
    { dedupingInterval: 0 },
  );
}

export function useFileExists(hostId: string, filePath: string | null) {
  return useSWR(
    filePath ? (["file.exists", hostId, filePath] as const) : null,
    ([method, host, path]) =>
      hostConnection(host).request(method, { filePath: path }),
    { dedupingInterval: 10_000 },
  );
}
