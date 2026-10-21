import type { WorkspaceFileEntry } from "@/lib";

export function missingDirectoryEntries(
  known: ReadonlySet<string>,
  children: readonly WorkspaceFileEntry[],
): WorkspaceFileEntry[] {
  return children.filter((entry) => !known.has(entry.relativePath));
}

export function mergeDirectoryEntries(
  base: readonly WorkspaceFileEntry[],
  loaded: readonly WorkspaceFileEntry[],
): readonly WorkspaceFileEntry[] {
  if (loaded.length === 0) {
    return base;
  }
  const known = new Set(base.map((entry) => entry.relativePath));
  return [...base, ...missingDirectoryEntries(known, loaded)];
}
