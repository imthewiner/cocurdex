import type { HostConnection } from "@cocurdex/client-runtime";
import {
  type CreateSessionPayload,
  generateLocalSessionTitle,
  type NewSessionDefaults,
  type SessionRecord,
} from "@cocurdex/shared";

export type StartConnection = Pick<HostConnection, "request" | "command">;

export interface StartRequest {
  payload: CreateSessionPayload;
  prompt: string;
  fallbackTitle: string;
}

interface UnsentStart {
  key: string;
  session: SessionRecord;
  messageId: string;
}

export function shownSessionPayload(
  workspaceId: string,
  defaults: NewSessionDefaults,
): CreateSessionPayload {
  return {
    workspaceId,
    agentType: defaults.agentType,
    model: defaults.model
      ? {
          providerId: defaults.model.providerId,
          modelId: defaults.model.modelId,
        }
      : null,
    permissionMode: defaults.permissionMode,
  };
}

export function createSessionStarter(connection: StartConnection) {
  let unsent: UnsentStart | null = null;

  const create = async (key: string, request: StartRequest) => {
    const title = generateLocalSessionTitle(
      request.prompt,
      request.fallbackTitle,
    );
    const session = await connection.request("session.create", {
      ...request.payload,
      title,
    });
    return { key, session, messageId: crypto.randomUUID() };
  };

  return async (request: StartRequest) => {
    const key = JSON.stringify([request.payload, request.prompt]);
    const pending = unsent?.key === key ? unsent : await create(key, request);
    unsent = pending;
    const { session, messageId } = pending;
    await connection.command(
      "session.send",
      {
        sessionId: session.id,
        messageId,
        content: request.prompt,
        attachments: [],
      },
      { idempotencyKey: messageId },
    );
    unsent = null;
    if (session.title !== request.fallbackTitle) {
      void connection
        .request("session.refineTitle", {
          sessionId: session.id,
          message: request.prompt,
          fallbackTitle: session.title,
          expectedTitle: session.title,
        })
        .catch(() => undefined);
    }
    return session;
  };
}
