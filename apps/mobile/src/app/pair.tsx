import { FieldGroup, Text, TextInput } from "@expo/ui";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native";
import { hosts, type PairFailure, PairToolbar } from "@/hosts";
import { useThemeColors } from "@/theme";
import { BrandHost } from "@/ui";

function useFailureMessages(): Record<PairFailure, string> {
  const { t } = useTranslation("hosts");
  return {
    link: t("pair.failure.link"),
    invalid: t("pair.failure.invalid"),
    rateLimited: t("pair.failure.rateLimited"),
    unreachable: t("pair.failure.unreachable"),
  };
}

export default function PairScreen() {
  const { t } = useTranslation("hosts");
  const failureMessages = useFailureMessages();
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
        label={pairing ? t("pair.pairing") : t("pair.action")}
        disabled={!canPair}
        onPair={() => void pair()}
      />
      <BrandHost style={styles.fill}>
        <FieldGroup>
          <FieldGroup.Section>
            <TextInput
              testID="pairing-link"
              placeholder={t("pair.linkPlaceholder")}
              autoCapitalize="none"
              autoFocus
              keyboardType="url"
              onChangeText={setLink}
              onSubmitEditing={() => void pair()}
            />
            <FieldGroup.SectionFooter>
              {failure ? (
                <Text textStyle={{ color: colors.destructive }}>
                  {failureMessages[failure]}
                </Text>
              ) : (
                <Text textStyle={{ color: colors.mutedForeground }}>
                  {t("pair.hint")}
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
