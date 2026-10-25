import CloseIcon from "@expo/material-symbols/close.xml";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { useThemeColors } from "@/theme";
import { useDiagramById } from "./mermaid-cache";
import {
  allowsMermaidNavigation,
  mermaidViewerDocument,
} from "./mermaid-document";

export function MermaidViewerScreen({
  diagramId,
  onClose,
}: {
  diagramId: string;
  onClose(): void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const entry = useDiagramById(diagramId);
  return (
    <>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon={Platform.OS === "ios" ? "xmark" : CloseIcon}
          accessibilityLabel={t("markdown.closeDiagram")}
          onPress={onClose}
        />
      </Stack.Toolbar>
      <View
        style={[styles.fill, { backgroundColor: colors.background }]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={t("markdown.diagram")}
        testID="mermaid-viewer"
      >
        {entry?.kind === "rendered" ? (
          <WebView
            source={{
              html: mermaidViewerDocument(entry.diagram.svg, colors.background),
            }}
            originWhitelist={["about:blank"]}
            javaScriptEnabled={false}
            setSupportMultipleWindows={false}
            allowsLinkPreview={false}
            setBuiltInZoomControls
            setDisplayZoomControls={false}
            onShouldStartLoadWithRequest={({ url }) =>
              allowsMermaidNavigation(url)
            }
            style={[styles.fill, { backgroundColor: colors.background }]}
          />
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
