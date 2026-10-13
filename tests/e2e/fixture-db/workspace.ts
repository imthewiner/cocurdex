import { execFileSync } from "node:child_process";
import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURE_SOURCE = fileURLToPath(
  new URL("../fixtures/acme-shop", import.meta.url),
);

const FIXTURE_GIT_ENV = {
  GIT_AUTHOR_NAME: "Acme Fixture",
  GIT_AUTHOR_EMAIL: "fixture@example.invalid",
  GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z",
  GIT_COMMITTER_NAME: "Acme Fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.invalid",
  GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z",
};

function git(cwd: string, args: string[]) {
  execFileSync("git", ["-c", "core.autocrlf=false", ...args], {
    cwd,
    env: { ...process.env, ...FIXTURE_GIT_ENV },
    stdio: "ignore",
  });
}

export async function materializeFixtureWorkspace(targetPath: string) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await cp(FIXTURE_SOURCE, targetPath, { recursive: true });
  git(targetPath, ["init", "-b", "main"]);
  git(targetPath, ["add", "."]);
  git(targetPath, ["commit", "-m", "Initial storefront"]);
  return targetPath;
}
