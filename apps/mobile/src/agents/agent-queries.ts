import useSWR from "swr";
import { hostConnection } from "@/connection";

const DAEMON_READ = { dedupingInterval: 0 };

export function useAgentRoles(hostId: string) {
  return useSWR(
    ["agentRole.list", hostId] as const,
    ([method, host]) => hostConnection(host).request(method),
    DAEMON_READ,
  );
}
