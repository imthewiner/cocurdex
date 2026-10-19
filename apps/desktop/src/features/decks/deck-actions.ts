import type { DeckExportFormat } from "@cocurdex/shared";
import { toast } from "sonner";
import { downloadDeck } from "./deck-download";

export async function exportDeckWithFeedback(
  id: string,
  format: DeckExportFormat,
  failureMessage: string,
) {
  try {
    await downloadDeck(id, format);
  } catch (error) {
    toast.error(failureMessage, {
      description: error instanceof Error ? error.message : String(error),
    });
  }
}
