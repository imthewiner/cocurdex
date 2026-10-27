import { Button, Text, TextInput, type TextInputRef } from "@expo/ui";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native";
import { hosts, type PairFailure, selectHost, usePairingRoutes } from "@/hosts";
import { useThemeColors } from "@/theme";
import {
  BrandHost,
  FieldSection,
  Form,
  FormSection,
  keyboardHidden,
  SheetAction,
} from "@/ui";

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
  const { switchToScan } = usePairingRoutes();
  const colors = useThemeColors();
  const linkInput = useRef<TextInputRef>(null);
  const [link, setLink] = useState("");
  const [pairing, setPairing] = useState(false);
  const [failure, setFailure] = useState<PairFailure | null>(null);
  const canPair = !pairing && link.trim() !== "";

  const pair = async () => {
    if (!canPair) return;
    linkInput.current?.blur();
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
    selectHost(result.host.hostId);
    await keyboardHidden();
    router.back();
  };

  const scanInstead = async () => {
    linkInput.current?.blur();
    await keyboardHidden();
    await switchToScan();
  };

  return (
    <>
      <SheetAction
        label={pairing ? t("pair.pairing") : t("pair.action")}
        disabled={!canPair}
        onPress={() => void pair()}
      />
      <BrandHost style={styles.fill}>
        <Form>
          <FieldSection
            footer={
              failure ? (
                <Text textStyle={{ color: colors.destructive }}>
                  {failureMessages[failure]}
                </Text>
              ) : (
                <Text textStyle={{ color: colors.mutedForeground }}>
                  {t("pair.hint")}
                </Text>
              )
            }
          >
            <TextInput
              ref={linkInput}
              testID="pairing-link"
              placeholder={t("pair.linkPlaceholder")}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              keyboardType="url"
              onChangeText={(value) => {
                setLink(value);
                setFailure(null);
              }}
              onSubmitEditing={() => void pair()}
            />
          </FieldSection>
          <FormSection>
            <Button
              variant="text"
              label={t("pair.scanInstead")}
              onPress={() => void scanInstead()}
            />
          </FormSection>
        </Form>
      </BrandHost>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
