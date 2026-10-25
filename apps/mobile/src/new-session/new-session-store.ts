import { useSyncExternalStore } from "react";
import { EMPTY_DRAFT, type NewSessionDraft } from "./new-session-draft";

interface NewSessionState {
  hostId: string | null;
  draft: NewSessionDraft;
}

let state: NewSessionState = { hostId: null, draft: EMPTY_DRAFT };
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function publish(next: NewSessionState) {
  state = next;
  for (const listener of [...listeners]) listener();
}

export function beginNewSession(hostId: string) {
  publish({ hostId, draft: EMPTY_DRAFT });
}

export function updateNewSessionDraft(
  change: (draft: NewSessionDraft) => NewSessionDraft,
) {
  publish({ ...state, draft: change(state.draft) });
}

export function useNewSessionState() {
  return useSyncExternalStore(subscribe, () => state);
}
