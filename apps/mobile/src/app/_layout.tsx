import "@/runtime";
import "@/i18n";
import { pathBaseName } from "@cocurdex/shared";
import { Stack, ThemeProvider } from "expo-router";
import { useTranslation } from "react-i18next";
import { Platform, useColorScheme } from "react-native";
import {
  navigationThemes,
  themeColors,
  useGroupedColors,
  useThemeColors,
} from "@/theme";

const PAIR_PRESENTATION = Platform.OS === "ios" ? "formSheet" : "modal";
const PUSH_ANIMATION =
  Platform.OS === "android" ? "slide_from_right" : "default";

function fileScreenTitle(params: object | undefined) {
  const path = params && "path" in params ? params.path : undefined;
  return typeof path === "string" ? pathBaseName(path) : "";
}

export default function RootLayout() {
  const { t } = useTranslation();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = useThemeColors();
  const grouped = useGroupedColors();
  return (
    <ThemeProvider value={navigationThemes[scheme]}>
      <Stack
        screenOptions={{
          statusBarStyle: scheme === "dark" ? "light" : "dark",
          headerTitleAlign: "center",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="session/[hostId]/[sessionId]"
          options={{
            title: "",
            headerBackButtonDisplayMode: "minimal",
            headerBackTitle: t("tabs.sessions"),
            animation: PUSH_ANIMATION,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
        <Stack.Screen
          name="note/[hostId]/[noteId]"
          options={{
            title: "",
            headerBackButtonDisplayMode: "minimal",
            headerBackTitle: t("tabs.notes"),
            animation: PUSH_ANIMATION,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
        <Stack.Screen
          name="issue/[hostId]/[issueId]"
          options={{
            title: "",
            headerBackButtonDisplayMode: "minimal",
            headerBackTitle: t("tabs.issues"),
            animation: PUSH_ANIMATION,
            headerStyle: { backgroundColor: grouped.page },
            contentStyle: { backgroundColor: grouped.page },
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: t("screens.settings"),
            headerBackButtonDisplayMode: "minimal",
            animation: PUSH_ANIMATION,
            headerStyle: { backgroundColor: grouped.page },
            contentStyle: { backgroundColor: grouped.page },
          }}
        />
        <Stack.Screen
          name="archived/[hostId]"
          options={{
            title: t("screens.archived"),
            headerBackButtonDisplayMode: "minimal",
            animation: PUSH_ANIMATION,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
        <Stack.Screen
          name="tool-call/[hostId]/[sessionId]/[toolCallId]"
          options={{
            title: "",
            headerBackButtonDisplayMode: "minimal",
            animation: PUSH_ANIMATION,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
        <Stack.Screen
          name="file/[hostId]"
          options={({ route }) => ({
            title: fileScreenTitle(route.params),
            headerBackButtonDisplayMode: "minimal",
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
            presentation: PAIR_PRESENTATION,
            sheetAllowedDetents: [0.6, 1],
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen
          name="new-session"
          options={{ headerShown: false, presentation: "modal" }}
        />
        <Stack.Screen
          name="new-issue/[hostId]"
          options={{
            title: t("screens.newIssue"),
            presentation: "modal",
            headerStyle: { backgroundColor: grouped.page },
            contentStyle: { backgroundColor: grouped.page },
          }}
        />
        <Stack.Screen
          name="new-note/[hostId]"
          options={{
            title: t("screens.newNote"),
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
    </ThemeProvider>
  );
}
