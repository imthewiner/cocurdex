import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { control, layout, space, useThemeColors } from "@/theme";

export function Composer({
  running,
  canSend,
  onSend,
  onStop,
}: {
  running: boolean;
  canSend: boolean;
  onSend(text: string): Promise<boolean>;
  onStop(): void;
}) {
  const { t } = useTranslation("sessions");
  const colors = useThemeColors();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const hasText = text.trim() !== "";
  const stopping = running && !hasText;

  const submit = async () => {
    if (stopping) {
      onStop();
      return;
    }
    if (!hasText || sending) return;
    setSending(true);
    const sent = await onSend(text.trim());
    setSending(false);
    if (sent) setText("");
  };

  return (
    <View
      style={[
        styles.bar,
        { borderTopColor: colors.border, backgroundColor: colors.background },
      ]}
    >
      <TextInput
        testID="composer-input"
        value={text}
        onChangeText={setText}
        editable={canSend}
        multiline
        placeholder={t("composer.placeholder")}
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.input,
          { borderColor: colors.input, color: colors.foreground },
        ]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={stopping ? t("composer.stop") : t("composer.send")}
        accessibilityState={{ disabled: !canSend || (!stopping && !hasText) }}
        disabled={!canSend || sending || (!stopping && !hasText)}
        onPress={() => void submit()}
        style={({ pressed }) => [
          styles.send,
          { backgroundColor: colors.foreground },
          (pressed || sending || (!stopping && !hasText)) && styles.dimmed,
        ]}
      >
        <SymbolView
          name={
            stopping
              ? { ios: "stop.fill", android: "stop" }
              : { ios: "arrow.up", android: "arrow_upward" }
          }
          size={18}
          tintColor={colors.background}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.sm,
    paddingHorizontal: layout.sideMargin,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: control.standard.height,
    maxHeight: 132,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: control.standard.radius,
    paddingHorizontal: space.md,
    paddingVertical: 9,
    fontSize: 16,
  },
  send: {
    width: control.standard.height,
    height: control.standard.height,
    borderRadius: control.standard.radius,
    alignItems: "center",
    justifyContent: "center",
  },
  dimmed: { opacity: 0.4 },
});
