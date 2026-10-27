import type { NativeStackNavigationOptions } from "expo-router";

export interface ListSearch {
  placeholder: string;
  onQuery(query: string): void;
}

export interface ListHeader {
  options: NativeStackNavigationOptions;
}
