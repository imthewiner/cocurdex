import type {
  CommandReceiptRepository,
  ToolCallRepository,
} from "@cocurdex/db";
import { COMMAND_RECEIPT_TTL_MS } from "./command-receipt-log";
import { logDaemonDiagnostic } from "./diagnostics";
import {
  EXTERNAL_TOOL_RESULT_MIN_BYTES,
  type ToolOutputStore,
} from "./tool-output-store";

const RECLAIM_PAGES_PER_STEP = 2048;
const EXTERNALIZE_BATCH_SIZE = 50;
const DEFAULT_MAINTENANCE_DELAY_MS = 30_000;

export interface StorageMaintenanceDeps {
  toolCalls: Pick<
    ToolCallRepository,
    "listExternalizableResults" | "externalizeResult" | "listResultRefs"
  >;
  toolOutputs: ToolOutputStore;
  commandReceipts: Pick<CommandReceiptRepository, "deleteCreatedBefore">;
  reclaimFreePages(maxPages: number): { reclaimed: number; remaining: number };
  isClosed(): boolean;
  delayMs?: number;
  now?: () => number;
}

function yieldToEventLoop() {
  return new Promise((resolve) => setImmediate(resolve));
}

export class StorageMaintenance {
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<void> | null = null;

  constructor(private readonly deps: StorageMaintenanceDeps) {}

  run(): Promise<void> {
    this.running ??= this.runOnce()
      .catch((error) => {
        logDaemonDiagnostic("warn", "[Storage] maintenance failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        this.running = null;
      });
    return this.running;
  }

  schedule() {
    if (this.timer || this.deps.isClosed()) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.run();
    }, this.deps.delayMs ?? DEFAULT_MAINTENANCE_DELAY_MS);
    this.timer.unref?.();
  }

  dispose() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private async runOnce() {
    const externalized = await this.externalizeLargeResults();
    if (this.deps.isClosed()) return;
    const removed = await this.deps.toolOutputs.removeUnreferenced(
      await this.deps.toolCalls.listResultRefs(),
    );
    if (this.deps.isClosed()) return;
    const now = this.deps.now?.() ?? Date.now();
    const expiredReceipts = await this.deps.commandReceipts.deleteCreatedBefore(
      new Date(now - COMMAND_RECEIPT_TTL_MS).toISOString(),
    );
    if (this.deps.isClosed()) return;
    const reclaimed = await this.reclaimFreePages();
    if (externalized + removed + expiredReceipts + reclaimed > 0) {
      logDaemonDiagnostic("info", "[Storage] maintenance", {
        externalizedResults: externalized,
        removedOutputs: removed,
        expiredReceipts,
        reclaimedPages: reclaimed,
      });
    }
  }

  private async externalizeLargeResults() {
    let externalized = 0;
    let afterRowId = 0;
    while (!this.deps.isClosed()) {
      const batch = await this.deps.toolCalls.listExternalizableResults({
        minBytes: EXTERNAL_TOOL_RESULT_MIN_BYTES,
        limit: EXTERNALIZE_BATCH_SIZE,
        afterRowId,
      });
      for (const candidate of batch) {
        afterRowId = candidate.rowId;
        const ref = await this.deps.toolOutputs.put(candidate.result);
        if (
          await this.deps.toolCalls.externalizeResult(
            candidate.toolCallId,
            candidate.updatedAt,
            ref,
          )
        ) {
          externalized += 1;
        }
      }
      if (batch.length < EXTERNALIZE_BATCH_SIZE) {
        return externalized;
      }
      await yieldToEventLoop();
    }
    return externalized;
  }

  private async reclaimFreePages() {
    let reclaimed = 0;
    while (!this.deps.isClosed()) {
      const step = this.deps.reclaimFreePages(RECLAIM_PAGES_PER_STEP);
      reclaimed += step.reclaimed;
      if (step.remaining === 0 || step.reclaimed === 0) {
        break;
      }
      await yieldToEventLoop();
    }
    return reclaimed;
  }
}
