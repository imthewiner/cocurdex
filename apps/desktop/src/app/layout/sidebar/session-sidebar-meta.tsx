import { Fragment } from "react";
import { Text } from "@/components/ui";
import { AgentIcon } from "@/features/sessions";
import type { SessionMetaItem } from "./session-sidebar-meta-items";

export function SessionSidebarMeta({
  items,
}: {
  items: readonly SessionMetaItem[];
}) {
  return (
    <span className="flex min-w-0 items-center gap-1 overflow-hidden text-sidebar-fg-subtle">
      {items.map((item, index) => (
        <Fragment key={item.key}>
          {index > 0 ? (
            <Text size="meta" className="shrink-0" aria-hidden>
              ·
            </Text>
          ) : null}
          <span className="flex min-w-0 shrink items-center gap-1">
            {item.agentId ? (
              <AgentIcon agentId={item.agentId} className="size-3.5" />
            ) : null}
            <Text size="meta" className="min-w-0 truncate">
              {item.label}
            </Text>
          </span>
        </Fragment>
      ))}
    </span>
  );
}
