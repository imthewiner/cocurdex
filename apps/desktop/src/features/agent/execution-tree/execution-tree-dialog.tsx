import type { ExecutionInteraction } from "@cocurdex/shared";
import { useSetAtom } from "jotai";
import { ChevronDown, ChevronRight, Hand, ListTree } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Text,
  Toggle,
} from "@/components/ui";
import { selectSessionAtom } from "@/features/sessions";
import { formatDurationMs } from "../view/chat-activity-state";
import { getRunDurationMs } from "./execution-tree-output";
import {
  DEFAULT_EXECUTION_TREE_VIEW,
  type ExecutionTreeRow,
  type ExecutionTreeView,
  flattenExecutionTree,
  toggleRunExpansion,
} from "./execution-tree-rows";
import { ExecutionStatusIcon } from "./execution-tree-status-icon";
import { ExecutionToolCallRow } from "./execution-tree-tool-call-row";
import { useExecutionTree } from "./use-execution-tree";

export interface ExecutionTreeDialogProps {
  sessionId: string;
  onClose(): void;
}

type RunRow = Extract<ExecutionTreeRow, { kind: "run" }>;
type SessionRow = Extract<ExecutionTreeRow, { kind: "session" }>;

function useInteractionLabel() {
  const { t } = useTranslation("sessions");
  return (interaction: ExecutionInteraction) => {
    if (interaction.kind === "permission") {
      return t("executionTree.waitingPermission", {
        title: interaction.record.title,
      });
    }
    if (interaction.kind === "question") {
      return t("executionTree.waitingAnswer", {
        question: interaction.record.question,
      });
    }
    return t("executionTree.waitingPlanApproval");
  };
}

function SessionRowContent({
  row,
  onOpenSession,
}: {
  row: SessionRow;
  onOpenSession(sessionId: string): void;
}) {
  const { t } = useTranslation("sessions");
  const { session, plan } = row.node;
  const done = plan?.steps.filter((step) => step.status === "completed");
  return (
    <button
      className="flex h-7 w-full min-w-0 items-center gap-2 rounded-control px-1 text-start hover:bg-accent"
      onClick={() => onOpenSession(session.id)}
      type="button"
    >
      <ExecutionStatusIcon status={session.status} />
      <Text className="min-w-0 flex-1 font-medium" size="body" truncate>
        {session.title}
      </Text>
      {plan ? (
        <Text className="shrink-0 tabular-nums" size="meta" tone="muted">
          {t("executionTree.planProgress", {
            done: done?.length ?? 0,
            total: plan.steps.length,
          })}
        </Text>
      ) : null}
      <Text className="shrink-0" size="meta" tone="muted">
        {session.agentType}
      </Text>
    </button>
  );
}

function RunSummary({ row }: { row: RunRow }) {
  const { t } = useTranslation("sessions");
  const durationMs = getRunDurationMs(row.run);
  const parts = [
    durationMs === null ? null : formatDurationMs(durationMs),
    t("executionTree.toolCount", { count: row.summary.toolCount }),
  ].filter((part): part is string => part !== null);
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <Text className="tabular-nums" size="meta" tone="muted">
        {parts.join(" · ")}
      </Text>
      {row.summary.failedCount > 0 ? (
        <Text className="tabular-nums" size="meta" tone="destructive">
          {t("executionTree.failedCount", { count: row.summary.failedCount })}
        </Text>
      ) : null}
      {row.summary.waitingCount > 0 ? (
        <Text className="text-status-warning tabular-nums" size="meta">
          {t("executionTree.waitingCount", {
            count: row.summary.waitingCount,
          })}
        </Text>
      ) : null}
    </span>
  );
}

function RunRowContent({
  row,
  onToggle,
}: {
  row: RunRow;
  onToggle(row: RunRow): void;
}) {
  const { t } = useTranslation("sessions");
  const Chevron = row.expanded ? ChevronDown : ChevronRight;
  return (
    <div className="flex min-w-0 flex-col">
      <button
        aria-expanded={row.expanded}
        className="flex h-7 w-full min-w-0 items-center gap-2 rounded-control px-1 text-start hover:bg-accent"
        onClick={() => onToggle(row)}
        type="button"
      >
        <Chevron className="size-3.5 shrink-0 text-muted-foreground" />
        <ExecutionStatusIcon status={row.run.status} />
        <Text className="min-w-0 flex-1" size="body" tone="subtle" truncate>
          {t("executionTree.run", {
            time: new Date(row.run.startedAt).toLocaleString(),
          })}
        </Text>
        <RunSummary row={row} />
      </button>
      {row.run.error ? (
        <Text className="ps-12" size="meta" tone="destructive" truncate>
          {row.run.error}
        </Text>
      ) : null}
    </div>
  );
}

function RowContent({
  row,
  onOpenSession,
  onToggleRun,
}: {
  row: ExecutionTreeRow;
  onOpenSession(sessionId: string): void;
  onToggleRun(row: RunRow): void;
}) {
  const { t } = useTranslation("sessions");
  const interactionLabel = useInteractionLabel();

  if (row.kind === "session") {
    return <SessionRowContent onOpenSession={onOpenSession} row={row} />;
  }
  if (row.kind === "run") {
    return <RunRowContent onToggle={onToggleRun} row={row} />;
  }
  if (row.kind === "toolCall") {
    return <ExecutionToolCallRow node={row.node} />;
  }
  if (row.kind === "interaction") {
    return (
      <div className="flex h-7 min-w-0 items-center gap-2 px-1">
        <Hand className="size-3.5 shrink-0 text-status-warning" />
        <Text className="min-w-0 flex-1" size="body" truncate>
          {interactionLabel(row.interaction)}
        </Text>
      </div>
    );
  }
  return (
    <Text className="flex h-7 items-center px-1" size="meta" tone="muted">
      {t("executionTree.truncated")}
    </Text>
  );
}

function ExecutionTreeBody({
  sessionId,
  onOpenSession,
}: {
  sessionId: string;
  onOpenSession(sessionId: string): void;
}) {
  const { t } = useTranslation("sessions");
  const state = useExecutionTree(sessionId);
  const [view, setView] = useState<ExecutionTreeView>(
    DEFAULT_EXECUTION_TREE_VIEW,
  );

  if (state.status === "loading") return null;
  if (state.status === "error" || !state.tree) {
    return (
      <EmptyState
        description={t("executionTree.unavailable")}
        icon={<ListTree />}
        title={t("executionTree.title")}
      />
    );
  }

  const rows = flattenExecutionTree(state.tree, view);
  const hasIssueRows = rows.some((row) => row.kind !== "session");
  const toggleRun = (row: RunRow) =>
    setView({
      ...view,
      runExpansion: toggleRunExpansion(
        view.runExpansion,
        row.run.id,
        row.expanded,
      ),
    });

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex justify-end">
        <Toggle
          onPressedChange={(issuesOnly) => setView({ ...view, issuesOnly })}
          pressed={view.issuesOnly}
          size="sm"
          variant="outline"
        >
          {t("executionTree.issuesOnly")}
        </Toggle>
      </div>
      {view.issuesOnly && !hasIssueRows ? (
        <Text className="px-1 py-2" size="meta" tone="muted">
          {t("executionTree.noIssues")}
        </Text>
      ) : null}
      <ul className="flex max-h-[60vh] flex-col overflow-y-auto overscroll-contain pb-2">
        {rows.map((row) => (
          <li
            key={row.key}
            style={{ paddingInlineStart: `${row.depth * 16}px` }}
          >
            <RowContent
              onOpenSession={onOpenSession}
              onToggleRun={toggleRun}
              row={row}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ExecutionTreeDialog({
  sessionId,
  onClose,
}: ExecutionTreeDialogProps) {
  const { t } = useTranslation("sessions");
  const selectSession = useSetAtom(selectSessionAtom);

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent size="wide">
        <DialogHeader>
          <DialogTitle>{t("executionTree.title")}</DialogTitle>
          <DialogDescription>
            {t("executionTree.description")}
          </DialogDescription>
        </DialogHeader>
        <ExecutionTreeBody
          onOpenSession={(id) => {
            selectSession(id);
            onClose();
          }}
          sessionId={sessionId}
        />
      </DialogContent>
    </Dialog>
  );
}
