import type { SupportedLocale } from "@cocurdex/shared";

export type Appearance = "light" | "dark";

export interface MobileTarget {
  deviceId: string;
  hostAlias: string | null;
  setAppearance(appearance: Appearance): Promise<void>;
  setLocale(locale: SupportedLocale): Promise<void>;
  resetState(): Promise<void>;
  diagnostics(): Promise<string>;
  stop(): Promise<void>;
}
