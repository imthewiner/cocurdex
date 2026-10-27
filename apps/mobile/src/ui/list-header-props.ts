import type { NativeStackNavigationOptions } from "expo-router";
import type { ReactElement } from "react";

export interface ListSearch {
  placeholder: string;
  onQuery(query: string): void;
}

export interface ListHeader {
  options: NativeStackNavigationOptions;
  header?: ReactElement;
}
