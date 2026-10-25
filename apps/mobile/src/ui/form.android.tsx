import { LazyColumn } from "@expo/ui/jetpack-compose";
import { background, fillMaxSize } from "@expo/ui/jetpack-compose/modifiers";
import { useGroupedColors } from "@/theme";
import type { FormProps } from "./form-props";

export function Form({ children }: FormProps) {
  const grouped = useGroupedColors();
  return (
    <LazyColumn
      verticalArrangement={{ spacedBy: 24 }}
      contentPadding={{ start: 16, end: 16, top: 16, bottom: 16 }}
      modifiers={[fillMaxSize(), background(grouped.page)]}
    >
      {children}
    </LazyColumn>
  );
}
