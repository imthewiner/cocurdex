import { useSyncExternalStore } from "react";
import { secureStorage } from "@/storage";
import { createHostsStore } from "./hosts-store";

export const hosts = createHostsStore(secureStorage);

export function useSavedHosts() {
  return useSyncExternalStore(hosts.subscribe, hosts.getSnapshot);
}
