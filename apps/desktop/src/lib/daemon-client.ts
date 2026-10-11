import type {
  DaemonConnectionInfo,
  DaemonMethod,
  DaemonRequestPayloadByMethod,
  DaemonResultByMethod,
} from "@cocurdex/rpc";
import {
  createDaemonRpcClient,
  createSharedTransport,
  createWebSocketTransport,
  type DaemonRpcClient,
  type DaemonRpcRequestOptions,
  daemonWebSocketProtocols,
} from "@cocurdex/rpc/client";
import { getHostBridge } from "./host-bridge";

let current: Promise<DaemonRpcClient> | null = null;

function connect(info: DaemonConnectionInfo, onDrop: () => void) {
  const socket = createWebSocketTransport(
    info.webSocketUrl,
    daemonWebSocketProtocols(info.token),
  );
  const transport = createSharedTransport((handlers) =>
    socket({
      onMessage: handlers.onMessage,
      onError(error) {
        onDrop();
        handlers.onError(error);
      },
      onClose() {
        onDrop();
        handlers.onClose();
      },
    }),
  );
  return createDaemonRpcClient(transport, info.token);
}

function getDaemonClient() {
  if (current) return current;
  const bridge = getHostBridge();
  const connection = bridge
    ? bridge.getDaemonConnection()
    : Promise.resolve(null);
  const attempt = connection.then((info) => {
    if (!info) throw new Error("The Cocurdex daemon is unavailable");
    return connect(info, drop);
  });
  const drop = () => {
    if (current === attempt) current = null;
  };
  current = attempt;
  attempt.catch(drop);
  return attempt;
}

export async function requestDaemon<M extends DaemonMethod>(
  method: M,
  params?: DaemonRequestPayloadByMethod[M],
  options?: DaemonRpcRequestOptions,
): Promise<DaemonResultByMethod[M]> {
  const client = await getDaemonClient();
  return client.request(method, params, options);
}
