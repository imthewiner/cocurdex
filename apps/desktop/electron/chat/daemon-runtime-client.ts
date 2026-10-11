import {
  readDaemonMetadata,
  subscribeDaemonEvents,
} from "@cocurdex/daemon/client";
import { createDaemonEventConnection } from "@cocurdex/rpc/event-connection";
import { createDaemonRuntimeLifecycle } from "./daemon-runtime-lifecycle";
import type {
  DaemonRuntimeClient,
  DaemonRuntimeClientOptions,
} from "./daemon-runtime-types";

export type {
  DaemonRuntimeClient,
  DaemonRuntimeStatus,
} from "./daemon-runtime-types";

export function createDaemonRuntimeClient(
  options: DaemonRuntimeClientOptions,
): DaemonRuntimeClient {
  const lifecycle = createDaemonRuntimeLifecycle(options);
  const ensureDaemon = lifecycle.ensure;
  const connection = createDaemonEventConnection({
    subscribe: (onEvent, subscribeOptions) =>
      subscribeDaemonEvents(onEvent, {
        ...subscribeOptions,
        userDataPath: options.userDataPath,
      }),
    ensure: ensureDaemon,
    onEvent: options.onEvent,
    onConnected: options.onConnected,
    onDisconnect(error) {
      lifecycle.invalidate();
      options.logger.warn("daemon.subscriptionDisconnected", {
        error: error.message,
      });
    },
  });
  return {
    async connection() {
      await ensureDaemon();
      const { webSocketUrl, token } = await readDaemonMetadata(
        options.userDataPath,
      );
      return { webSocketUrl, token };
    },
    async dispose() {
      connection.dispose();
      await lifecycle.dispose();
    },
    getStatus: lifecycle.getStatus,
    async initialize() {
      await ensureDaemon();
      await connection.connect();
    },
    async restart() {
      connection.reset();
      try {
        await lifecycle.restart();
      } finally {
        await connection.connect();
      }
      return lifecycle.getStatus();
    },
  };
}
