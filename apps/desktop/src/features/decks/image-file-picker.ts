import { DECK_IMAGE_MIME_TYPES } from "@cocurdex/shared";
import { desktopApi } from "@/lib";

export function canPickImageFiles() {
  return desktopApi.capabilities.localFilePaths;
}

export function pickImageFilePath(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = DECK_IMAGE_MIME_TYPES.join(",");
    input.addEventListener("cancel", () => resolve(null), { once: true });
    input.addEventListener(
      "change",
      () => {
        const file = input.files?.[0];
        resolve(file ? desktopApi.getPathForFile(file) : null);
      },
      { once: true },
    );
    input.click();
  });
}
