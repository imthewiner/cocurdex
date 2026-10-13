import { DaemonSkillsService } from "@cocurdex/daemon/internal/skills-service";
import { createTempDirs } from "@cocurdex/shared/testing";
import { afterAll, describe, expect, it } from "vitest";

const tempDirs = createTempDirs();

afterAll(() => tempDirs.cleanup());

describe("DaemonSkillsService authorization", () => {
  it("rejects project-scoped operations on unregistered roots", async () => {
    const sourceRoot = await tempDirs.create("cocurdex-skills-");
    const service = new DaemonSkillsService(sourceRoot, async () => false);

    await expect(
      service.install({
        scope: "project",
        workspaceRootPath: "/tmp/anywhere",
      }),
    ).rejects.toThrow("not a registered workspace");
    await expect(
      service.install({ scope: "project", workspaceRootPath: null }),
    ).rejects.toThrow("not a registered workspace");
  });

  it("does not require a workspace root for global scope", async () => {
    const sourceRoot = await tempDirs.create("cocurdex-skills-");
    const service = new DaemonSkillsService(sourceRoot, async () => false);

    await expect(
      service.getStatus({ scope: "global", workspaceRootPath: null }),
    ).resolves.toMatchObject({ sourceRoot });
  });
});
