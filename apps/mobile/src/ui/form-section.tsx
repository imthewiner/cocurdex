import { FieldGroup } from "@expo/ui";
import type { FormSectionProps } from "./form-props";

export function FormSection({
  title,
  header,
  footer,
  children,
}: FormSectionProps) {
  return (
    <FieldGroup.Section title={title}>
      {header ? (
        <FieldGroup.SectionHeader>{header}</FieldGroup.SectionHeader>
      ) : null}
      {children}
      {footer ? (
        <FieldGroup.SectionFooter>{footer}</FieldGroup.SectionFooter>
      ) : null}
    </FieldGroup.Section>
  );
}
