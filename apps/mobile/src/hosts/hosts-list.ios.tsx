import { List } from "@expo/ui/swift-ui";
import {
  listRowBackground,
  listStyle,
  scrollContentBackground,
} from "@expo/ui/swift-ui/modifiers";
import { StyleSheet } from "react-native";
import { useThemeColors } from "@/theme";
import { BrandHost } from "@/ui";
import { HostRows } from "./host-rows";

export function HostsList() {
  const colors = useThemeColors();
  return (
    <BrandHost style={styles.fill}>
      <List modifiers={[listStyle("plain"), scrollContentBackground("hidden")]}>
        <HostRows rowModifiers={[listRowBackground(colors.background)]} />
      </List>
    </BrandHost>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
