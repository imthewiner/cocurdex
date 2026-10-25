import { FieldGroup } from "@expo/ui";
import type { FormProps } from "./form-props";

export function Form({ children }: FormProps) {
  return <FieldGroup>{children}</FieldGroup>;
}
