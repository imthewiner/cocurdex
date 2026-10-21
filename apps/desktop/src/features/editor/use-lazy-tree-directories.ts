import type { UseFileTreeResult } from "@pierre/trees/react";
import { useEffect, useRef, useState } from "react";
import type { WorkspaceFileEntry } from "@/lib";
import { desktopApi } from "@/lib";
import {
  mergeDirectoryEntries,
  missingDirectoryEntries,
} from "./file-tree-directory-entries";
import { collectExpandedDirectoryPaths } from "./file-tree-expansion";

type FileTreeModel = UseFileTreeResult["model"];

interface LoadedDirectories {
  base: readonly WorkspaceFileEntry[];
  entries: readonly WorkspaceFileEntry[];
}

export interface LazyTreeDirectories {
  files: readonly WorkspaceFileEntry[];
  loadDirectory(directoryPath: string): void;
}

export function useLazyTreeDirectories(
  rootPath: string | null,
  baseFiles: readonly WorkspaceFileEntry[],
): LazyTreeDirectories {
  const [loaded, setLoaded] = useState<LoadedDirectories | null>(null);
  const requestedRef = useRef({
    base: baseFiles,
    rootPath,
    directories: new Set<string>(),
  });
  const entries = loaded?.base === baseFiles ? loaded.entries : [];

  const loadDirectory = (directoryPath: string) => {
    const requested = requestedRef.current;
    if (requested.base !== baseFiles || requested.rootPath !== rootPath) {
      requestedRef.current = {
        base: baseFiles,
        rootPath,
        directories: new Set(),
      };
    }
    const directories = requestedRef.current.directories;
    if (!rootPath || directories.has(directoryPath)) {
      return;
    }
    directories.add(directoryPath);
    const relativePath = directoryPath.replace(/\/$/, "") || ".";
    void desktopApi
      .listWorkspaceDirectory(rootPath, relativePath)
      .then((children) => {
        if (requestedRef.current.directories !== directories) {
          return;
        }
        setLoaded((previous) => {
          const previousEntries =
            previous?.base === baseFiles ? previous.entries : [];
          const known = new Set(
            [...baseFiles, ...previousEntries].map(
              (entry) => entry.relativePath,
            ),
          );
          const missing = missingDirectoryEntries(known, children);
          if (missing.length === 0) {
            return previous;
          }
          return { base: baseFiles, entries: [...previousEntries, ...missing] };
        });
      })
      .catch(() => {
        directories.delete(directoryPath);
      });
  };

  return {
    files: mergeDirectoryEntries(baseFiles, entries),
    loadDirectory,
  };
}

export function useLoadExpandedTreeDirectories(
  model: FileTreeModel,
  filePaths: readonly string[],
  isLoading: boolean,
  loadDirectory: (directoryPath: string) => void,
) {
  const loadDirectoryRef = useRef(loadDirectory);
  loadDirectoryRef.current = loadDirectory;

  useEffect(() => {
    if (isLoading) {
      return;
    }
    const loadExpanded = () => {
      loadDirectoryRef.current("");
      for (const directoryPath of collectExpandedDirectoryPaths(
        model,
        filePaths,
      )) {
        loadDirectoryRef.current(directoryPath);
      }
    };
    loadExpanded();
    return model.subscribe(loadExpanded);
  }, [model, filePaths, isLoading]);
}
