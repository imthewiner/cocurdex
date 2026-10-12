import type {
  AgentId,
  ContextHandoffStrategy,
  ContextTransferRecord,
} from "@cocurdex/shared";

export interface ContextTransferConsumption {
  targetAgentType: AgentId;
  sourceAgentTypes: AgentId[];
  strategy: ContextHandoffStrategy;
  coveredMessageCount: number;
  handoffText: string;
  consumedByMessageId: string;
  consumedAt: string;
}

export interface ContextTransferRepository {
  insert(record: ContextTransferRecord): void;
  listByTargetSession(sessionId: string): ContextTransferRecord[];
  findPending(sessionId: string): ContextTransferRecord | null;
  consume(id: string, consumption: ContextTransferConsumption): void;
  reopenConsumedBy(sessionId: string, messageIds: readonly string[]): void;
}
