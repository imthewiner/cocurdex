import { ListItem, type ListItemProps } from "@expo/ui";

const TRANSPARENT = "#00000000";

export function FormRow(props: ListItemProps) {
  return <ListItem {...props} colors={{ containerColor: TRANSPARENT }} />;
}
