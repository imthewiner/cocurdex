import type { MermaidAppearance } from "@cocurdex/shared";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, useColorScheme, View } from "react-native";
import { SvgCss } from "react-native-svg/css";
import { WebView } from "react-native-webview";
import { space } from "@/theme";
import { diagrams, useDiagram } from "./mermaid-cache";
import {
  allowsMermaidNavigation,
  mermaidDocument,
  parseMermaidMessage,
} from "./mermaid-document";

function DiagramRenderer({
  source,
  appearance,
}: {
  source: string;
  appearance: MermaidAppearance;
}) {
  return (
    <View style={styles.renderer} pointerEvents="none">
      <WebView
        source={{ html: mermaidDocument(source, appearance) }}
        originWhitelist={["about:blank"]}
        scrollEnabled={false}
        javaScriptEnabled
        setSupportMultipleWindows={false}
        allowsLinkPreview={false}
        onShouldStartLoadWithRequest={({ url }) => allowsMermaidNavigation(url)}
        onError={() => diagrams.failed(source, appearance)}
        onMessage={({ nativeEvent }) => {
          const message = parseMermaidMessage(nativeEvent.data);
          if (message?.type === "error") diagrams.failed(source, appearance);
          if (message?.type === "rendered") {
            const { svg, width, height } = message;
            diagrams.rendered(source, appearance, { svg, width, height });
          }
        }}
      />
    </View>
  );
}

export function MermaidDiagram({
  source,
  fallback,
}: {
  source: string;
  fallback: ReactNode;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const appearance = useColorScheme() === "dark" ? "dark" : "light";
  const entry = useDiagram(source, appearance);
  if (entry?.kind === "failed") return fallback;
  if (!entry)
    return <DiagramRenderer source={source} appearance={appearance} />;
  const { svg, width, height } = entry.diagram;
  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={t("markdown.diagram")}
      accessibilityHint={t("markdown.openDiagram")}
      testID="mermaid-diagram"
      onPress={() =>
        router.push({
          pathname: "/diagram/[diagramId]",
          params: { diagramId: entry.id },
        })
      }
      style={[styles.frame, { maxWidth: width, aspectRatio: width / height }]}
    >
      <SvgCss xml={svg} width="100%" height="100%" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  renderer: { width: "100%", height: 1, opacity: 0 },
  frame: { width: "100%", alignSelf: "center", marginBottom: space.sm },
});
