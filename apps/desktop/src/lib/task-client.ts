import type { TaskApi } from "@cocurdex/shared";
import { requestDaemon as rpc } from "./daemon-client";
import type { TaskEventBridge } from "./types";

function getTaskEventBridge(): TaskEventBridge {
  if (typeof window === "undefined" || !window.taskEvents) {
    throw new Error(
      "Task service is unavailable. Connect to an execution host.",
    );
  }
  return window.taskEvents;
}

export const taskApi: TaskApi = {
  submitPreviousMessage: (input) => rpc("session.resubmit", input),
  getPreviousMessageCheckpointStatus: (sessionId, messageId) =>
    rpc("session.checkpointStatus", { sessionId, messageId }),
  listSessions: () => rpc("session.list"),
  getSessionSnapshot: (sessionId) => rpc("session.snapshot", { sessionId }),
  saveSessionConfiguration: (input) => rpc("session.configure", input),
  sendMessage: (input) => rpc("session.send", input),
  stopSession: async (sessionId) => {
    await rpc("session.stop", { sessionId });
  },
  resolvePermission: (requestId, optionId) =>
    rpc("permission.resolve", { requestId, optionId }),
  resolveQuestion: (questionId, answer) =>
    rpc("question.resolve", { questionId, answer }),
  resolvePlanApproval: (approvalId, decision) =>
    rpc("planApproval.resolve", {
      approvalId,
      decision: {
        outcome: decision.outcome,
        feedback: decision.feedback ?? null,
      },
    }),
  onAgentEvent: (listener) => getTaskEventBridge().onAgentEvent(listener),
};
