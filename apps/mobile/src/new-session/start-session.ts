import type { HostConnection } from "@cocurdex/client-runtime";
import {
  type CreateSessionPayload,
  generateLocalSessionTitle,
} from "@cocurdex/shared";
import { randomUUID } from "expo-crypto";

export async function startSession(
  connection: HostConnection,
  payload: CreateSessionPayload,
  prompt: string,
  fallbackTitle: string,
) {
  const title = generateLocalSessionTitle(prompt, fallbackTitle);
  const session = await connection.request("session.create", {
    ...payload,
    title,
  });
  const messageId = randomUUID();
  await connection.command(
    "session.send",
    { sessionId: session.id, messageId, content: prompt, attachments: [] },
    { idempotencyKey: messageId },
  );
  if (title !== fallbackTitle) {
    void connection
      .request("session.refineTitle", {
        sessionId: session.id,
        message: prompt,
        fallbackTitle: title,
        expectedTitle: title,
      })
      .catch(() => undefined);
  }
  return session;
}
