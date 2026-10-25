import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { useThemeColors } from "@/theme";
import { CloseButton } from "@/ui";
import {
  allowsMermaidNavigation,
  mermaidViewerDocument,
} from "./mermaid-document";
import { useDiagramById } from "./mermaid-store";

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
      <CloseButton
        accessibilityLabel={t("markdown.closeDiagram")}
        onPress={onClose}
      />
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
