import type { DaemonTransport } from "@cocurdex/rpc/client";

export interface HostEndpoint {
  webSocketUrl: string;
  token: string;
}

export interface NetworkSignal {
  isOnline(): boolean;
  subscribe(listener: (online: boolean) => void): () => void;
}

export interface LifecycleSignal {
  subscribeForeground(listener: () => void): () => void;
}

export interface PlatformSignals {
  network?: NetworkSignal;
  lifecycle?: LifecycleSignal;
}

export interface HostPlatform extends PlatformSignals {
  resolveEndpoint(): Promise<HostEndpoint>;
  openTransport?(endpoint: HostEndpoint): DaemonTransport;
}
