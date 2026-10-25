import type { ReactElement } from "react";

export function HostedAccessory({
  children,
}: {
  children: ReactElement;
  onPress?(): void;
}) {
  return children;
}
