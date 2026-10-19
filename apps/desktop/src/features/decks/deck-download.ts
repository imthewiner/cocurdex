import { buildDaemonDeckDownloadUrl } from "@cocurdex/shared";
import { desktopApi, resolveLocalDaemonConnection } from "@/lib";
import { decksApi } from "./decks-api";

export async function downloadDeckPptx(id: string) {
  const [download, connection] = await Promise.all([
    decksApi.createDownload({ id, format: "pptx" }),
    resolveLocalDaemonConnection(),
  ]);
  await desktopApi.downloadUrl(
    buildDaemonDeckDownloadUrl(connection.webSocketUrl, download),
  );
}
