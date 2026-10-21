import type { ProductSkillScope } from "@cocurdex/shared";
import { useState } from "react";
import { desktopApi, useMountEffect } from "@/lib";
import type { ProductSkillsStatus } from "@/lib/types";
import type { SkillDotState } from "./skill-library-model";

export type SkillPackStatuses = Partial<
  Record<ProductSkillScope, ProductSkillsStatus>
>;

export interface SkillPackState {
  statuses: SkillPackStatuses;
  isLoaded: boolean;
  workspaceRootPath: string | null;
  refresh(): Promise<void>;
  setStatus(scope: ProductSkillScope, status: ProductSkillsStatus): void;
}

export function packDotState(
  statuses: SkillPackStatuses,
): SkillDotState | null {
  const all = Object.values(statuses);
  if (all.some((status) => status.conflict)) {
    return "problem";
  }
  if (all.some((status) => status.installed && status.updateAvailable)) {
    return "update";
  }
  return all.some((status) => status.installed) ? "ok" : null;
}

export function useSkillPack(workspaceRootPath: string | null): SkillPackState {
  const [statuses, setStatuses] = useState<SkillPackStatuses>({});
  const [isLoaded, setIsLoaded] = useState(false);

  const refresh = async () => {
    try {
      const [global, project] = await Promise.all([
        desktopApi.getProductSkillsStatus("global"),
        workspaceRootPath
          ? desktopApi.getProductSkillsStatus("project", workspaceRootPath)
          : null,
      ]);
      setStatuses(project ? { global, project } : { global });
    } finally {
      setIsLoaded(true);
    }
  };

  const setStatus = (scope: ProductSkillScope, status: ProductSkillsStatus) => {
    setStatuses((current) => ({ ...current, [scope]: status }));
  };

  useMountEffect(() => {
    void refresh();
  });

  return { statuses, isLoaded, workspaceRootPath, refresh, setStatus };
}
