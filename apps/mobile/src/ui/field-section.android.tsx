import { Children, isValidElement } from "react";
import type { FormSectionProps } from "./form-props";
import { FormRow } from "./form-row";
import { FormSection } from "./form-section";

export function FieldSection({ children, ...props }: FormSectionProps) {
  const fields = Children.toArray(children).filter(isValidElement);
  return (
    <FormSection {...props}>
      {fields.map((field, index) => (
        <FormRow key={field.key ?? index}>{field}</FormRow>
      ))}
    </FormSection>
  );
}
