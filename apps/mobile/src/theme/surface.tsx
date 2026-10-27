import { createContext, type ReactNode, use } from "react";
import {
  SafeAreaInsetsContext,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

export type Surface = "page" | "sheet";

const SurfaceContext = createContext<Surface>("page");

export function SheetSurface({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <SurfaceContext value="sheet">
      <SafeAreaInsetsContext value={{ ...insets, top: 0 }}>
        {children}
      </SafeAreaInsetsContext>
    </SurfaceContext>
  );
}

export function useSurface(): Surface {
  return use(SurfaceContext);
}
