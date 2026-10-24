import { List } from "@expo/ui";
import { StyleSheet } from "react-native";
import { BrandHost } from "@/ui";
import { HostRows } from "./host-rows";

export function HostsList() {
  return (
    <BrandHost style={styles.fill}>
      <List>
        <HostRows />
      </List>
    </BrandHost>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
