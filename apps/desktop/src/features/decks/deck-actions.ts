import { toast } from "sonner";
import { downloadDeckPptx } from "./deck-download";

export async function exportDeckWithFeedback(
  id: string,
  failureMessage: string,
) {
  try {
    await downloadDeckPptx(id);
  } catch (error) {
    toast.error(failureMessage, {
      description: error instanceof Error ? error.message : String(error),
    });
  }
}
