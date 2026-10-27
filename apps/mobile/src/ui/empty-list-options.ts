import type { NativeStackNavigationOptions } from "expo-router";

export function emptyListOptions(title: string): NativeStackNavigationOptions {
  return {
    title,
    headerShadowVisible: true,
    headerSearchBarOptions: undefined,
  };
}
