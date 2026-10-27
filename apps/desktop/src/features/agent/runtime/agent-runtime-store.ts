import {
  type AgentEvent,
  type AgentSessionRuntimeState,
  applySessionRuntimeEvent,
  EMPTY_AGENT_SESSION_RUNTIME_STATE,
  isSessionRuntimeEvent,
  seedSessionRuntimeState,
} from "@cocurdex/shared";
import { atom } from "jotai";

export type { AgentSessionRuntimeState };

export const agentRuntimeBySessionAtom = atom<
  Record<string, AgentSessionRuntimeState>
>({});

export const applyAgentRuntimeEventAtom = atom(
  null,
  (get, set, event: AgentEvent) => {
    if (!isSessionRuntimeEvent(event)) return;
    const current = get(agentRuntimeBySessionAtom);
    set(agentRuntimeBySessionAtom, {
      ...current,
      [event.sessionId]: applySessionRuntimeEvent(
        current[event.sessionId] ?? EMPTY_AGENT_SESSION_RUNTIME_STATE,
        event,
      ),
    });
  },
);

export const seedAgentRuntimeAtom = atom(
  null,
  (
    get,
    set,
    payload: { sessionId: string; state: AgentSessionRuntimeState },
  ) => {
    const current = get(agentRuntimeBySessionAtom);
    set(agentRuntimeBySessionAtom, {
      ...current,
      [payload.sessionId]: seedSessionRuntimeState(
        current[payload.sessionId],
        payload.state,
      ),
    });
  },
);

export const clearAgentRuntimeForSessionAtom = atom(
  null,
  (get, set, sessionId: string) => {
    const current = get(agentRuntimeBySessionAtom);
    const { [sessionId]: _removed, ...next } = current;
    set(agentRuntimeBySessionAtom, next);
  },
);
