import AddIcon from "@expo/material-symbols/add.xml";
import { List, ListItem, Text } from "@expo/ui";
import { Stack, useRouter } from "expo-router";
import { Platform, StyleSheet } from "react-native";
import { EmptyHosts, useSavedHosts } from "@/hosts";
import { BrandHost } from "@/ui";

export default function ComputersScreen() {
  const router = useRouter();
  const saved = useSavedHosts();
  const openPairing = () => router.push("/pair");

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={Platform.OS === "ios" ? "plus" : AddIcon}
          accessibilityLabel="Pair a Computer"
          onPress={openPairing}
        />
      </Stack.Toolbar>
      {saved.length === 0 ? (
        <EmptyHosts onPair={openPairing} />
      ) : (
        <BrandHost style={styles.fill}>
          <List>
            {saved.map((host) => (
              <ListItem
                key={host.hostId}
                supportingText={new URL(host.baseUrl).host}
              >
                <Text>{host.name}</Text>
              </ListItem>
            ))}
          </List>
        </BrandHost>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
