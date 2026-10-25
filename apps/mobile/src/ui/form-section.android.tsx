import { Column, Text, useMaterialColors } from "@expo/ui/jetpack-compose";
import {
  background,
  clip,
  fillMaxWidth,
  padding,
  Shapes,
} from "@expo/ui/jetpack-compose/modifiers";
import { Children, isValidElement } from "react";
import { useGroupedColors } from "@/theme";
import type { FormSectionProps } from "./form-props";

const OUTER_RADIUS = 20;
const INNER_RADIUS = 4;

function rowShape(index: number, count: number) {
  const top = index === 0 ? OUTER_RADIUS : INNER_RADIUS;
  const bottom = index === count - 1 ? OUTER_RADIUS : INNER_RADIUS;
  return Shapes.RoundedCorner({
    topStart: top,
    topEnd: top,
    bottomStart: bottom,
    bottomEnd: bottom,
  });
}

export function FormSection({
  title,
  header,
  footer,
  children,
}: FormSectionProps) {
  const colors = useMaterialColors();
  const grouped = useGroupedColors();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <Column verticalArrangement={{ spacedBy: 4 }} modifiers={[fillMaxWidth()]}>
      {header ? <Column modifiers={[fillMaxWidth()]}>{header}</Column> : null}
      {title && !header ? (
        <Column modifiers={[padding(16, 0, 16, 8)]}>
          <Text
            color={colors.onSurfaceVariant}
            style={{ typography: "titleMedium" }}
          >
            {title}
          </Text>
        </Column>
      ) : null}
      {rows.length > 0 ? (
        <Column
          verticalArrangement={{ spacedBy: 2 }}
          modifiers={[fillMaxWidth()]}
        >
          {rows.map((row, index) => (
            <Column
              key={row.key ?? index}
              modifiers={[
                fillMaxWidth(),
                clip(rowShape(index, rows.length)),
                background(grouped.cell),
              ]}
            >
              {row}
            </Column>
          ))}
        </Column>
      ) : null}
      {footer ? (
        <Column modifiers={[padding(16, 4, 16, 0)]}>{footer}</Column>
      ) : null}
    </Column>
  );
}
