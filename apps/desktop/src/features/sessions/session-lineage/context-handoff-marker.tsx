import type { ContextTransferRecord } from "@cocurdex/shared";
import {
  ArrowRightLeft,
  ChevronDown,
  ChevronRight,
  GitFork,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "@/components/ui";
import { getAgentDisplayLabel } from "../session-store";
import { useMessageContextTransfer } from "./context-transfers-store";

function handoffLabel(
  transfer: ContextTransferRecord,
  t: ReturnType<typeof useTranslation<"sessions">>["t"],
) {
  const count = transfer.coveredMessageCount;
  const target = transfer.targetAgentType
    ? getAgentDisplayLabel(transfer.targetAgentType)
    : "";
  if (transfer.kind === "fork") {
    return t("lineage.handoff.fork", { count, target });
  }
  const sources = transfer.sourceAgentTypes
    .map((agentType) => getAgentDisplayLabel(agentType))
    .join(", ");
  return transfer.strategy === "delta"
    ? t("lineage.handoff.delta", { count, sources, target })
    : t("lineage.handoff.full", { count, sources, target });
}

export function ContextHandoffMarker({
  message,
}: {
  message: { id: string; sessionId: string };
}) {
  const { t } = useTranslation("sessions");
  const transfer = useMessageContextTransfer(message);
  const [expanded, setExpanded] = useState(false);
  if (!transfer?.handoffText) return null;
  const Icon = transfer.kind === "fork" ? GitFork : ArrowRightLeft;
  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <div className="flex w-full max-w-3xl min-w-0 flex-col gap-2 self-center py-1">
      <button
        aria-expanded={expanded}
        className="flex w-full min-w-0 items-center gap-3 text-left"
        onClick={() => setExpanded((value) => !value)}
        title={expanded ? t("lineage.handoff.hide") : t("lineage.handoff.show")}
        type="button"
      >
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        <Text
          className="flex shrink-0 items-center gap-1.5"
          size="meta"
          tone="muted"
        >
          <Icon aria-hidden="true" className="size-3.5 shrink-0" />
          {handoffLabel(transfer, t)}
          <Chevron aria-hidden="true" className="size-3.5 shrink-0" />
        </Text>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </button>
      {expanded ? (
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-card border border-chat-border-soft bg-chat-surface-subtle px-4 py-3 text-meta text-chat-fg-secondary">
          {transfer.handoffText}
        </pre>
      ) : null}
    </div>
  );
}
