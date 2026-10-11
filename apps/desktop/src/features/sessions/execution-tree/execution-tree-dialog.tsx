import type { ExecutionInteraction } from "@cocurdex/shared";
import { useSetAtom } from "jotai";
import {
  AlertCircle,
  Check,
  Circle,
  EyeOff,
  Hand,
  ListTree,
  Loader2,
  type LucideIcon,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Text,
} from "@/components/ui";
import { cn } from "@/lib";
import { selectSessionAtom } from "../session-store";
import {
  type ExecutionTreeRow,
  flattenExecutionTree,
} from "./execution-tree-rows";
import { useExecutionTree } from "./use-execution-tree";

export interface ExecutionTreeDialogProps {
  sessionId: string;
  onClose(): void;
}

const statusIcons: Record<string, LucideIcon> = {
  running: Loader2,
  in_progress: Loader2,
  pending: Loader2,
  completed: Check,
  failed: AlertCircle,
  error: AlertCircle,
  cancelled: X,
  interrupted: X,
  exited: X,
  idle: Circle,
};

function StatusIcon({ status }: { status: string }) {
  const Icon = statusIcons[status] ?? Circle;
  return (
    <Icon
      className={cn(
        "size-3.5 shrink-0 text-muted-foreground",
        Icon === Loader2 && "animate-spin",
        Icon === AlertCircle && "text-destructive",
      )}
    />
  );
}

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

function RowContent({
  row,
  onOpenSession,
}: {
  row: ExecutionTreeRow;
  onOpenSession(sessionId: string): void;
}) {
  const { t } = useTranslation("sessions");
  const interactionLabel = useInteractionLabel();

  if (row.kind === "session") {
    const { session, plan } = row.node;
    const done = plan?.steps.filter((step) => step.status === "completed");
    return (
      <button
        className="flex h-7 w-full min-w-0 items-center gap-2 rounded-control px-1 text-start hover:bg-accent"
        onClick={() => onOpenSession(session.id)}
        type="button"
      >
        <StatusIcon status={session.status} />
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

  if (row.kind === "run") {
    return (
      <div className="flex h-7 min-w-0 items-center gap-2 px-1">
        <StatusIcon status={row.run.status} />
        <Text className="min-w-0 flex-1" size="body" tone="subtle" truncate>
          {t("executionTree.run", {
            time: new Date(row.run.startedAt).toLocaleString(),
          })}
        </Text>
        {row.run.error ? (
          <Text
            className="min-w-0 shrink"
            size="meta"
            tone="destructive"
            truncate
          >
            {row.run.error}
          </Text>
        ) : null}
      </div>
    );
  }

  if (row.kind === "toolCall") {
    const { toolCall, observability, subagent } = row.node;
    return (
      <div className="flex min-w-0 flex-col px-1">
        <div className="flex h-7 min-w-0 items-center gap-2">
          <StatusIcon status={toolCall.status} />
          <Text className="min-w-0 flex-1" size="body" truncate>
            {toolCall.title}
          </Text>
        </div>
        {observability === "limited" ? (
          <div className="flex min-h-6 min-w-0 items-center gap-2 ps-5">
            <EyeOff className="size-3.5 shrink-0 text-muted-foreground" />
            <Text className="min-w-0 flex-1" size="meta" tone="muted" truncate>
              {t("executionTree.limited", {
                name: subagent?.description || subagent?.type || "",
              })}
            </Text>
          </div>
        ) : null}
      </div>
    );
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

  return (
    <ul className="flex max-h-[60vh] flex-col overflow-y-auto overscroll-contain">
      {flattenExecutionTree(state.tree).map((row) => (
        <li key={row.key} style={{ paddingInlineStart: `${row.depth * 16}px` }}>
          <RowContent onOpenSession={onOpenSession} row={row} />
        </li>
      ))}
    </ul>
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
