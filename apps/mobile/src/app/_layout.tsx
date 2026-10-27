import "@/runtime";
import "@/i18n";
import { pathBaseName } from "@cocurdex/shared";
import { Stack, ThemeProvider } from "expo-router";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { MermaidRendererHost } from "@/markdown";
import {
  navigationThemes,
  themeColors,
  useGroupedColors,
  useThemeColors,
  useThemeName,
} from "@/theme";
import { useHeaderOptions } from "@/ui";

const SHEET_PRESENTATION = Platform.OS === "ios" ? "formSheet" : "modal";
const PUSH_ANIMATION =
  Platform.OS === "android" ? "slide_from_right" : "default";

function fileScreenTitle(params: object | undefined) {
  const path = params && "path" in params ? params.path : undefined;
  return typeof path === "string" ? pathBaseName(path) : "";
}

export default function RootLayout() {
  const { t } = useTranslation();
  const scheme = useThemeName();
  const colors = useThemeColors();
  const grouped = useGroupedColors();
  const headerOptions = useHeaderOptions();
  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider value={navigationThemes[scheme]}>
        <Stack
          screenOptions={{
            ...headerOptions,
            statusBarStyle: scheme === "dark" ? "light" : "dark",
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="session/[hostId]/[sessionId]"
            options={{
              title: "",
              headerBackTitle: t("tabs.sessions"),
              animation: PUSH_ANIMATION,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
          <Stack.Screen
            name="note/[hostId]/[noteId]"
            options={{
              title: "",
              headerBackTitle: t("tabs.notes"),
              animation: PUSH_ANIMATION,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
          <Stack.Screen
            name="issue/[hostId]/[issueId]"
            options={{
              title: "",
              headerBackTitle: t("tabs.issues"),
              animation: PUSH_ANIMATION,
              headerStyle: { backgroundColor: grouped.page },
              contentStyle: { backgroundColor: grouped.page },
            }}
          />
          <Stack.Screen
            name="computers"
            options={{
              title: t("screens.computers"),
              headerBackTitle: t("tabs.settings"),
              animation: PUSH_ANIMATION,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
          <Stack.Screen
            name="computer/[hostId]"
            options={{
              title: "",
              animation: PUSH_ANIMATION,
              headerStyle: { backgroundColor: grouped.page },
              contentStyle: { backgroundColor: grouped.page },
            }}
          />
          <Stack.Screen
            name="archived/[hostId]"
            options={{
              title: t("screens.archived"),
              animation: PUSH_ANIMATION,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
          <Stack.Screen
            name="tool-call/[hostId]/[sessionId]/[toolCallId]"
            options={{
              title: "",
              animation: PUSH_ANIMATION,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
          <Stack.Screen
            name="file/[hostId]"
            options={({ route }) => ({
              title: fileScreenTitle(route.params),
              animation: PUSH_ANIMATION,
              contentStyle: { backgroundColor: colors.background },
            })}
          />
          <Stack.Screen
            name="image/[hostId]/index"
            options={{
              title: "",
              presentation: "fullScreenModal",
              headerTransparent: true,
              headerTintColor: themeColors.dark.foreground,
              statusBarStyle: "light",
              contentStyle: { backgroundColor: themeColors.dark.background },
            }}
          />
          <Stack.Screen
            name="diagram/[diagramId]"
            options={{
              title: "",
              presentation: "fullScreenModal",
              headerTransparent: true,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
          <Stack.Screen
            name="pair"
            options={{
              title: t("screens.pair"),
              presentation: SHEET_PRESENTATION,
              sheetAllowedDetents: [0.6, 1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen
            name="list-options"
            options={{
              headerShown: false,
              presentation: SHEET_PRESENTATION,
              sheetAllowedDetents: [0.75, 1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen
            name="issue-filters"
            options={{
              headerShown: false,
              presentation: SHEET_PRESENTATION,
              sheetAllowedDetents: [0.6, 1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen
            name="session-config/[hostId]/[sessionId]"
            options={{
              headerShown: false,
              presentation: SHEET_PRESENTATION,
              sheetAllowedDetents: [0.75, 1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen
            name="new-session/index"
            options={{
              title: "",
              headerBackTitle: t("tabs.sessions"),
              animation: PUSH_ANIMATION,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
          <Stack.Screen
            name="new-session/config"
            options={{
              headerShown: false,
              presentation: SHEET_PRESENTATION,
              sheetAllowedDetents: [0.75, 1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen
            name="new-issue/[hostId]"
            options={{
              title: t("screens.newIssue"),
              presentation: "modal",
              headerStyle: { backgroundColor: colors.background },
              contentStyle: { backgroundColor: colors.background },
            }}
          />
          <Stack.Screen
            name="rename-session/[hostId]/[sessionId]"
            options={{
              title: t("screens.renameSession"),
              presentation: "modal",
              headerStyle: { backgroundColor: grouped.page },
              contentStyle: { backgroundColor: grouped.page },
            }}
          />
          <Stack.Screen
            name="rename-computer/[hostId]"
            options={{
              title: t("screens.renameComputer"),
              presentation: "modal",
              headerStyle: { backgroundColor: grouped.page },
              contentStyle: { backgroundColor: grouped.page },
            }}
          />
          <Stack.Screen
            name="scan"
            options={{
              title: "",
              presentation: "fullScreenModal",
              headerTransparent: true,
              headerTintColor: themeColors.dark.foreground,
              statusBarStyle: "light",
            }}
          />
        </Stack>
        <MermaidRendererHost />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
