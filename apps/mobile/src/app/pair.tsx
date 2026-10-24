import { FieldGroup, Text, TextInput } from "@expo/ui";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet } from "react-native";
import { hosts, type PairFailure, PairToolbar } from "@/hosts";
import { useThemeColors } from "@/theme";
import { BrandHost } from "@/ui";

const FAILURE_MESSAGES: Record<PairFailure, string> = {
  link: "Paste the full pairing link from your computer.",
  invalid: "This pairing link has expired or was already used.",
  rateLimited: "Too many attempts. Wait a minute and try again.",
  unreachable:
    "Can't reach the computer. Check that both are on the same network.",
};

export default function PairScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [link, setLink] = useState("");
  const [pairing, setPairing] = useState(false);
  const [failure, setFailure] = useState<PairFailure | null>(null);
  const canPair = !pairing && link.trim() !== "";

  const pair = async () => {
    if (!canPair) return;
    setPairing(true);
    setFailure(null);
    const result = await hosts.pair(
      link,
      Constants.deviceName ?? "Cocurdex Mobile",
    );
    setPairing(false);
    if ("failure" in result) {
      setFailure(result.failure);
      return;
    }
    router.back();
  };

  return (
    <>
      <PairToolbar
        label={pairing ? "Pairing…" : "Pair"}
        disabled={!canPair}
        onPair={() => void pair()}
      />
      <BrandHost style={styles.fill}>
        <FieldGroup>
          <FieldGroup.Section>
            <TextInput
              testID="pairing-link"
              placeholder="Pairing link"
              autoCapitalize="none"
              autoFocus
              keyboardType="url"
              onChangeText={setLink}
              onSubmitEditing={() => void pair()}
            />
            <FieldGroup.SectionFooter>
              {failure ? (
                <Text textStyle={{ color: colors.destructive }}>
                  {FAILURE_MESSAGES[failure]}
                </Text>
              ) : (
                <Text textStyle={{ color: colors.mutedForeground }}>
                  On your computer, open Settings › Devices and create a
                  pairing.
                </Text>
              )}
            </FieldGroup.SectionFooter>
          </FieldGroup.Section>
        </FieldGroup>
      </BrandHost>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
