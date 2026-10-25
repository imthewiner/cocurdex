import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, useColorScheme, View } from "react-native";
import { WebView } from "react-native-webview";
import { space } from "@/theme";
import { mermaidDocument, parseMermaidMessage } from "./mermaid-document";

type DiagramState = { kind: "rendering" } | { kind: "ready"; height: number };

export function MermaidDiagram({
  source,
  fallback,
}: {
  source: string;
  fallback: ReactNode;
}) {
  const { t } = useTranslation();
  const appearance = useColorScheme() === "dark" ? "dark" : "light";
  const [failed, setFailed] = useState(false);
  const [state, setState] = useState<DiagramState>({ kind: "rendering" });
  if (failed) return fallback;
  const height = state.kind === "ready" ? state.height : 1;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t("markdown.diagram")}
      testID="mermaid-diagram"
      style={[styles.frame, { height }]}
    >
      <WebView
        source={{ html: mermaidDocument(source, appearance) }}
        originWhitelist={["about:blank"]}
        scrollEnabled={false}
        javaScriptEnabled
        setSupportMultipleWindows={false}
        style={styles.web}
        onError={() => setFailed(true)}
        onMessage={({ nativeEvent }) => {
          const message = parseMermaidMessage(nativeEvent.data);
          if (message?.type === "error") setFailed(true);
          if (message?.type === "size") {
            setState({ kind: "ready", height: message.height });
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: "100%", marginBottom: space.sm, overflow: "hidden" },
  web: { backgroundColor: "transparent" },
});
