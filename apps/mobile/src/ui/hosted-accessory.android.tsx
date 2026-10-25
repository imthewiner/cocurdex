import { RNHostView } from "@expo/ui";
import type { ReactElement } from "react";

export function HostedAccessory({ children }: { children: ReactElement }) {
  return <RNHostView matchContents>{children}</RNHostView>;
}
