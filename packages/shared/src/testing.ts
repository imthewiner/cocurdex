import { mkdtempSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface TempDirs {
  create(prefix: string): Promise<string>;
  createSync(prefix: string): string;
  cleanup(): Promise<void>;
}

export function createTempDirs(): TempDirs {
  const created: string[] = [];
  return {
    async create(prefix) {
      const directory = await mkdtemp(path.join(os.tmpdir(), prefix));
      created.push(directory);
      return directory;
    },
    createSync(prefix) {
      const directory = mkdtempSync(path.join(os.tmpdir(), prefix));
      created.push(directory);
      return directory;
    },
    async cleanup() {
      const directories = created.splice(0);
      await Promise.allSettled(
        directories.map((directory) =>
          rm(directory, { recursive: true, force: true, maxRetries: 3 }),
        ),
      );
    },
  };
}
