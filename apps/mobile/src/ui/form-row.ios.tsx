import { ListItem, type ListItemProps } from "@expo/ui";
import { listRowBackground } from "@expo/ui/swift-ui/modifiers";
import { useGroupedColors } from "@/theme";

export function FormRow({ modifiers, ...props }: ListItemProps) {
  const grouped = useGroupedColors();
  return (
    <ListItem
      {...props}
      modifiers={[listRowBackground(grouped.cell), ...(modifiers ?? [])]}
    />
  );
}
