import {
  Button,
  Column,
  FieldGroup,
  Text,
  TextInput,
  useNativeState,
} from "@expo/ui";
import Constants from "expo-constants";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet } from "react-native";
import { hosts, type PairFailure } from "@/hosts";
import { space, useThemeColors } from "@/theme";
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
  const params = useLocalSearchParams<{ link?: string }>();
  const initialLink = params.link ?? "";
  const linkField = useNativeState(initialLink);
  const [link, setLink] = useState(initialLink);
  const [pairing, setPairing] = useState(false);
  const [failure, setFailure] = useState<PairFailure | null>(null);

  const pair = async () => {
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
    <BrandHost style={styles.fill}>
      <Column spacing={space.md}>
        <FieldGroup>
          <TextInput
            testID="pairing-link"
            placeholder="Pairing link"
            autoCapitalize="none"
            autoFocus
            keyboardType="url"
            value={linkField}
            onChangeText={setLink}
            onSubmitEditing={() => void pair()}
          />
        </FieldGroup>
        {failure ? (
          <Text textStyle={{ color: colors.destructive }}>
            {FAILURE_MESSAGES[failure]}
          </Text>
        ) : null}
        <Button
          label={pairing ? "Pairing…" : "Pair"}
          disabled={pairing || link.trim() === ""}
          onPress={() => void pair()}
        />
      </Column>
    </BrandHost>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
