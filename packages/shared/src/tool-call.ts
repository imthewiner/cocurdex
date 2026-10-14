import type { AgentToolCallContent } from "./contracts";
import { countChangedLines } from "./workspace-change-diff";

export interface GetToolCallResultInput {
  toolCallId: string;
}

export function isToolCallId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 4096 &&
    /^[^\p{Cc}]+$/u.test(value.replaceAll("\n", " "))
  );
}

export function summarizeToolCallDiff(
  item: Extract<AgentToolCallContent, { type: "diff" }>,
): Extract<AgentToolCallContent, { type: "diff" }> {
  if (item.newText === undefined) {
    return item;
  }
  return {
    type: "diff",
    path: item.path,
    ...countChangedLines(item.oldText ?? "", item.newText),
  };
}
