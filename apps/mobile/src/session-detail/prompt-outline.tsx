import TocIcon from "@expo/material-symbols/toc.xml";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import { useOptionSheet } from "@/ui";
import type { CondensedItem } from "./transcript-activity";
import { promptOutline } from "./transcript-jump";

const MIN_PROMPTS = 2;

export function PromptOutline({
  items,
  onJump,
}: {
  items: readonly CondensedItem[];
  onJump(id: string): void;
}) {
  const { t } = useTranslation("sessions");
  const optionSheet = useOptionSheet();
  const prompts = promptOutline(items);
  const open = () =>
    optionSheet.open({
      title: t("detail.prompts"),
      items: prompts.map((prompt, position) => ({
        key: prompt.id,
        testID: `transcript-prompt-${prompt.id}`,
        label: prompt.text || t("detail.imagePrompt"),
        supporting: t("detail.promptNumber", { number: position + 1 }),
        onPress: () => onJump(prompt.id),
      })),
    });
  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={Platform.OS === "ios" ? "list.bullet" : TocIcon}
          accessibilityLabel={t("detail.prompts")}
          hidden={prompts.length < MIN_PROMPTS}
          onPress={open}
        />
      </Stack.Toolbar>
      {optionSheet.sheet}
    </>
  );
}
