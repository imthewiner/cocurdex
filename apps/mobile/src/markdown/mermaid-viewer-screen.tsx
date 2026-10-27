import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { WebView } from "react-native-webview";
import { useThemeColors, useThemeName } from "@/theme";
import { CloseButton } from "@/ui";
import { DiagramPreview } from "./diagram-preview";
import type { RenderedDiagram } from "./mermaid-cache";
import {
  allowsMermaidNavigation,
  mermaidViewerDocument,
} from "./mermaid-document";
import { diagramSource, useDiagram } from "./mermaid-store";

function FittedPreview({ diagram }: { diagram: RenderedDiagram }) {
  const window = useWindowDimensions();
  const scale = Math.min(
    window.width / diagram.width,
    window.height / diagram.height,
  );
  return (
    <View style={styles.center} pointerEvents="none">
      <View
        style={{ width: diagram.width * scale, height: diagram.height * scale }}
      >
        <DiagramPreview diagram={diagram} />
      </View>
    </View>
  );
}

function ZoomableDiagram({
  diagram,
  background,
}: {
  diagram: RenderedDiagram;
  background: string;
}) {
  return (
    <>
      <FittedPreview diagram={diagram} />
      <WebView
        source={{ html: mermaidViewerDocument(diagram.svg, background) }}
        originWhitelist={["about:blank"]}
        javaScriptEnabled={false}
        setSupportMultipleWindows={false}
        allowsLinkPreview={false}
        setBuiltInZoomControls
        setDisplayZoomControls={false}
        onShouldStartLoadWithRequest={({ url }) => allowsMermaidNavigation(url)}
        style={styles.webView}
      />
    </>
  );
}

function ThemedDiagram({
  source,
  background,
}: {
  source: string;
  background: string;
}) {
  const entry = useDiagram(source, useThemeName());
  if (entry?.kind !== "rendered") return null;
  return <ZoomableDiagram diagram={entry.diagram} background={background} />;
}

export function MermaidViewerScreen({
  diagramId,
  onClose,
}: {
  diagramId: string;
  onClose(): void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [source] = useState(() => diagramSource(diagramId));
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
        {source === null ? null : (
          <ThemedDiagram source={source} background={colors.background} />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  webView: { flex: 1, backgroundColor: "transparent" },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
});
