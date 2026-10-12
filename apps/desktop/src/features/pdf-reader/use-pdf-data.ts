import { useState } from "react";
import { desktopApi, useMountEffect } from "@/lib";

export type PdfLoadStatus = "loading" | "ready" | "error";

async function createPdfObjectUrl(filePath: string) {
  const base64 = await desktopApi.readPdfBase64(filePath);
  const response = await fetch(`data:application/pdf;base64,${base64}`);
  return URL.createObjectURL(await response.blob());
}

export function usePdfData(filePath: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<PdfLoadStatus>("loading");

  useMountEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    createPdfObjectUrl(filePath)
      .then((created) => {
        if (cancelled) {
          URL.revokeObjectURL(created);
          return;
        }
        objectUrl = created;
        setUrl(created);
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  });

  return { url, status, setStatus };
}
