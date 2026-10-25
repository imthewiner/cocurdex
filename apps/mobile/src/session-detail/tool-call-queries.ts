import useSWR from "swr";
import { hostConnection } from "@/connection";

const DAEMON_READ = { dedupingInterval: 0 };

export function useToolCallResult(
  hostId: string,
  toolCallId: string,
  version: string | null,
) {
  return useSWR(
    version === null
      ? null
      : (["session.getToolCallResult", hostId, toolCallId, version] as const),
    ([method, host, id]) =>
      hostConnection(host).request(method, { toolCallId: id }),
    DAEMON_READ,
  );
}
