import useSWR from "swr";
import { hostConnection } from "@/connection";

const DAEMON_READ = { dedupingInterval: 0 };

export function useNotes(hostId: string) {
  return useSWR(
    ["note.list", hostId] as const,
    ([method, host]) => hostConnection(host).request(method),
    DAEMON_READ,
  );
}

export function useNote(hostId: string, noteId: string) {
  return useSWR(
    ["note.get", hostId, noteId] as const,
    ([method, host, id]) => hostConnection(host).request(method, { id }),
    DAEMON_READ,
  );
}
