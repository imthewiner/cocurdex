import AddIcon from "@expo/material-symbols/add.xml";
import { Stack, useRouter } from "expo-router";
import { Platform } from "react-native";
import { EmptyHosts, HostsList, useSavedHosts } from "@/hosts";

export default function ComputersScreen() {
  const router = useRouter();
  const hasHosts = useSavedHosts().length > 0;
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
      {hasHosts ? <HostsList /> : <EmptyHosts onPair={openPairing} />}
    </>
  );
}
