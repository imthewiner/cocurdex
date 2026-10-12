import { readFile, stat } from "node:fs/promises";
import { resolveAuthorizedPdfReadPath } from "@cocurdex/shared/node";

export const MAX_PDF_READ_BYTES = 100 * 1024 * 1024;

export async function readAuthorizedPdf(
  filePath: string,
  workspaceRootPaths: string[],
): Promise<string> {
  const resolvedPath = await resolveAuthorizedPdfReadPath(
    filePath,
    workspaceRootPaths,
  );
  const stats = await stat(resolvedPath);
  if (stats.size > MAX_PDF_READ_BYTES) {
    throw new Error("PDF is too large to open");
  }
  return (await readFile(resolvedPath)).toString("base64");
}
