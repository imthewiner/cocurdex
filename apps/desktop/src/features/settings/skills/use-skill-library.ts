import type {
  SkillLibraryList,
  SkillUpdateCheckResult,
} from "@cocurdex/shared";
import { useRef, useState } from "react";
import { useMountEffect } from "@/lib";
import { skillsApi } from "./skills-api";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export interface SkillLibraryState {
  library: SkillLibraryList | null;
  loadError: string;
  isChecking: boolean;
  lastCheck: SkillUpdateCheckResult | null;
  refresh(): Promise<void>;
  checkUpdates(): Promise<void>;
}

export function useSkillLibrary(workspaceId: string | null): SkillLibraryState {
  const [library, setLibrary] = useState<SkillLibraryList | null>(null);
  const [loadError, setLoadError] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<SkillUpdateCheckResult | null>(
    null,
  );
  const requestRef = useRef(0);

  const refresh = async () => {
    const request = ++requestRef.current;
    try {
      const next = await skillsApi.list(workspaceId);
      if (request === requestRef.current) {
        setLibrary(next);
        setLoadError("");
      }
    } catch (error) {
      if (request === requestRef.current) {
        setLoadError(errorMessage(error));
      }
    }
  };

  const checkUpdates = async () => {
    setIsChecking(true);
    try {
      setLastCheck(await skillsApi.checkUpdates(workspaceId));
      await refresh();
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setIsChecking(false);
    }
  };

  useMountEffect(() => {
    void refresh();
  });

  return { library, loadError, isChecking, lastCheck, refresh, checkUpdates };
}
