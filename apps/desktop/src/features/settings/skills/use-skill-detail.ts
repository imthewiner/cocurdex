import type { InstalledSkillDetail, SkillRef } from "@cocurdex/shared";
import { useRef, useState } from "react";
import { useMountEffect } from "@/lib";
import { skillsApi } from "./skills-api";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function useSkillDetail(ref: SkillRef) {
  const [detail, setDetail] = useState<InstalledSkillDetail | null>(null);
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const busyRef = useRef(false);

  useMountEffect(() => {
    let active = true;
    skillsApi.show(ref).then(
      (next) => {
        if (active) setDetail(next);
      },
      (showError) => {
        if (active) setError(errorMessage(showError));
      },
    );
    return () => {
      active = false;
    };
  });

  const run = async (
    action: () => Promise<InstalledSkillDetail | null>,
  ): Promise<boolean> => {
    if (busyRef.current) {
      return false;
    }
    busyRef.current = true;
    setIsBusy(true);
    setError("");
    try {
      const next = await action();
      if (next) {
        setDetail(next);
      }
      return true;
    } catch (actionError) {
      setError(errorMessage(actionError));
      return false;
    } finally {
      busyRef.current = false;
      setIsBusy(false);
    }
  };

  return { detail, error, isBusy, run };
}
