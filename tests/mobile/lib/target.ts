export type Appearance = "light" | "dark";

export interface MobileTarget {
  deviceId: string;
  hostAlias: string | null;
  setAppearance(appearance: Appearance): Promise<void>;
  resetState(): Promise<void>;
  stop(): Promise<void>;
}
