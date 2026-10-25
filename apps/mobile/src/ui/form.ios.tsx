import { FieldGroup } from "@expo/ui";
import {
  background,
  scrollContentBackground,
} from "@expo/ui/swift-ui/modifiers";
import { useGroupedColors } from "@/theme";
import type { FormProps } from "./form-props";

export function Form({ children }: FormProps) {
  const grouped = useGroupedColors();
  return (
    <FieldGroup
      modifiers={[scrollContentBackground("hidden"), background(grouped.page)]}
    >
      {children}
    </FieldGroup>
  );
}
