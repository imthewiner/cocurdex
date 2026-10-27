import { Text, TextInput, type TextInputRef } from "@expo/ui";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native";
import { hosts, useSavedHosts } from "@/hosts";
import { useThemeColors } from "@/theme";
import {
  BrandHost,
  FieldSection,
  Form,
  keyboardHidden,
  SheetAction,
} from "@/ui";

export function RenameComputerForm({ hostId }: { hostId: string }) {
  const { t } = useTranslation("hosts");
  const router = useRouter();
  const colors = useThemeColors();
  const input = useRef<TextInputRef>(null);
  const host = useSavedHosts().find((saved) => saved.hostId === hostId);
  const initialName = host?.name ?? "";
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();
  const canSave =
    host !== undefined && trimmed !== "" && trimmed !== initialName;

  const save = async () => {
    if (!canSave) return;
    input.current?.blur();
    hosts.rename(hostId, trimmed);
    await keyboardHidden();
    router.back();
  };

  return (
    <>
      <SheetAction
        label={t("rename.save")}
        disabled={!canSave}
        onPress={() => void save()}
      />
      <BrandHost style={styles.fill}>
        <Form>
          <FieldSection
            footer={
              <Text textStyle={{ color: colors.mutedForeground }}>
                {t("rename.footer")}
              </Text>
            }
          >
            <TextInput
              ref={input}
              testID="rename-computer-name"
              placeholder={t("rename.placeholder")}
              defaultValue={initialName}
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
              onSubmitEditing={() => void save()}
              onChangeText={setName}
            />
          </FieldSection>
        </Form>
      </BrandHost>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
