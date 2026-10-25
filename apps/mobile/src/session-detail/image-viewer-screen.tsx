import CloseIcon from "@expo/material-symbols/close.xml";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { Image, Platform, StyleSheet, View } from "react-native";
import { useSavedHosts } from "@/hosts";
import { themeColors } from "@/theme";
import { imageAttachmentSource } from "./image-attachments";

const viewerColors = themeColors.dark;

export function ImageViewerScreen({
  hostId,
  filePath,
  name,
  onClose,
}: {
  hostId: string;
  filePath: string;
  name: string;
  onClose(): void;
}) {
  const { t } = useTranslation("sessions");
  const host = useSavedHosts().find((saved) => saved.hostId === hostId);
  return (
    <>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon={Platform.OS === "ios" ? "xmark" : CloseIcon}
          accessibilityLabel={t("image.close")}
          onPress={onClose}
        />
      </Stack.Toolbar>
      <View style={styles.fill}>
        {host ? (
          <Image
            accessibilityLabel={name}
            testID="image-viewer"
            resizeMode="contain"
            source={imageAttachmentSource(host, { filePath })}
            style={styles.fill}
          />
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: viewerColors.background },
});
