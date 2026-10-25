import { Directory, File, Paths } from "expo-file-system";
import type { RenderedDiagram } from "./mermaid-cache";

const directory = new Directory(Paths.cache, "mermaid");
let nextImage = 0;

function clearDirectory() {
  try {
    if (directory.exists) directory.delete();
    directory.create();
  } catch {
    return;
  }
}

clearDirectory();

export async function saveImage(png: string) {
  nextImage += 1;
  const file = new File(directory, `${nextImage}.png`);
  try {
    await file.write(png, { encoding: "base64" });
    return file.uri;
  } catch {
    return null;
  }
}

export function releaseImage(diagram: RenderedDiagram) {
  if (!diagram.image) return;
  try {
    new File(diagram.image).delete();
  } catch {
    return;
  }
}
