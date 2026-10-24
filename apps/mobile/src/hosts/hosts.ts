import { useSyncExternalStore } from "react";
import { installMarker, secureStorage } from "@/storage";
import {
  createHostsStore,
  forgetHostsFromPreviousInstall,
} from "./hosts-store";

export const hosts = createHostsStore(secureStorage);
forgetHostsFromPreviousInstall(installMarker, hosts);

export function useSavedHosts() {
  return useSyncExternalStore(hosts.subscribe, hosts.getSnapshot);
}
