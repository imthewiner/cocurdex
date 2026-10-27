import { File, Paths } from "expo-file-system";
import { useSyncExternalStore } from "react";

export type IssueLayout = "list" | "board";

const file = new File(Paths.document, "issue-layout.json");
const listeners = new Set<() => void>();

function readStoredLayout(): IssueLayout {
  try {
    return file.exists && JSON.parse(file.textSync()) === "board"
      ? "board"
      : "list";
  } catch {
    return "list";
  }
}

let layout = readStoredLayout();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setIssueLayout(next: IssueLayout) {
  layout = next;
  for (const listener of listeners) listener();
  void file.write(JSON.stringify(next)).catch(() => undefined);
}

export function useIssueLayout() {
  return useSyncExternalStore(subscribe, () => layout);
}
