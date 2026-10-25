import useSWR from "swr";
import { hostConnection } from "@/connection";

const DAEMON_READ = { dedupingInterval: 0 };

export function useIssueView(hostId: string) {
  return useSWR(
    ["issue.loadView", hostId] as const,
    ([method, host]) => hostConnection(host).request(method, {}),
    DAEMON_READ,
  );
}

export function useIssueDetail(hostId: string, issueId: string) {
  return useSWR(
    ["issue.getDetail", hostId, issueId] as const,
    ([method, host, id]) => hostConnection(host).request(method, { id }),
    DAEMON_READ,
  );
}
