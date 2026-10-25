import type { SavedHost } from "@cocurdex/client-runtime";
import { Text } from "@expo/ui";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native";
import { useSavedHosts } from "@/hosts";
import { useHostSessions } from "@/sessions";
import { useThemeColors } from "@/theme";
import {
  BrandHost,
  FolderIcon,
  Form,
  FormRow,
  FormSection,
  SelectedMark,
} from "@/ui";
import {
  chooseWorkspace,
  draftWorkspaceId,
  workspaceChoices,
} from "./new-session-draft";
import { updateNewSessionDraft, useNewSessionState } from "./new-session-store";

function Picker({ host }: { host: SavedHost }) {
  const { t } = useTranslation("sessions");
  const router = useRouter();
  const colors = useThemeColors();
  const { draft } = useNewSessionState();
  const { workspaces, sessions } = useHostSessions(host.hostId);
  const [query, setQuery] = useState("");
  const choices = workspaceChoices(workspaces, sessions);
  const selectedId = draftWorkspaceId(draft, choices);
  const needle = query.trim().toLocaleLowerCase();
  const shown = choices.filter((choice) =>
    choice.workspace.name.toLocaleLowerCase().includes(needle),
  );

  const pick = (workspaceId: string) => {
    updateNewSessionDraft((current) => chooseWorkspace(current, workspaceId));
    router.back();
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: t("newSession.searchWorkspaces"),
            hideWhenScrolling: false,
            onChangeText: (event) => setQuery(event.nativeEvent.text),
            onCancelButtonPress: () => setQuery(""),
          },
        }}
      />
      <BrandHost style={styles.fill}>
        <Form>
          <FormSection
            footer={
              <Text textStyle={{ color: colors.mutedForeground }}>
                {t("newSession.addOnComputer")}
              </Text>
            }
          >
            {shown.map(({ workspace, sessionCount }) => (
              <FormRow
                key={workspace.id}
                testID={`workspace-choice-${workspace.id}`}
                onPress={() => pick(workspace.id)}
                leading={<FolderIcon />}
                supportingText={
                  <Text textStyle={{ color: colors.mutedForeground }}>
                    {t("newSession.sessionCount", { count: sessionCount })}
                  </Text>
                }
                trailing={
                  <SelectedMark selected={workspace.id === selectedId} />
                }
              >
                <Text>{workspace.name}</Text>
              </FormRow>
            ))}
          </FormSection>
        </Form>
      </BrandHost>
    </>
  );
}

export function WorkspacePicker() {
  const { hostId } = useNewSessionState();
  const host = useSavedHosts().find((saved) => saved.hostId === hostId);
  return host ? <Picker host={host} /> : null;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
