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
  type DaemonRpcSubscribeOptions,
  daemonWebSocketProtocols,
} from "@cocurdex/rpc/client";
import type { CocurdexDaemonEvent, DaemonEventMeta } from "@cocurdex/shared";
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

async function getConnectionInfo() {
  const info = await getHostBridge()?.getDaemonConnection();
  if (!info) throw new Error("The Cocurdex daemon is unavailable");
  return info;
}

function getDaemonClient() {
  if (current) return current;
  const attempt = getConnectionInfo().then((info) => connect(info, drop));
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

export async function subscribeDaemon(
  onEvent: (event: CocurdexDaemonEvent, meta: DaemonEventMeta) => void,
  options: DaemonRpcSubscribeOptions,
) {
  const info = await getConnectionInfo();
  const transport = createWebSocketTransport(
    info.webSocketUrl,
    daemonWebSocketProtocols(info.token),
  );
  return createDaemonRpcClient(transport, info.token).subscribe(
    onEvent,
    options,
  );
}
