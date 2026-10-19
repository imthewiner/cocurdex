import { desktopApi } from "@/lib";
import type { PresenterSession } from "./deck-presenter-view";

export async function startPresenterSession(): Promise<PresenterSession | null> {
  const channel = crypto.randomUUID();
  try {
    const result = await desktopApi.openPresentationWindow({ channel });
    if (!result.opened) return null;
    return {
      channel,
      externalDisplay: result.externalDisplay,
      startedAt: Date.now(),
    };
  } catch {
    return null;
  }
}
