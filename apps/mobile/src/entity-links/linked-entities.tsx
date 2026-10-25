import type {
  EntityLink,
  EntityLinkRelation,
  EntityRef,
} from "@cocurdex/shared";
import { Text as UiText } from "@expo/ui";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { entityLinkHref } from "@/markdown";
import { layout, space, useThemeColors } from "@/theme";
import { FormRow, FormSection, ListSectionHeader, ListSeparator } from "@/ui";
import { useEntityLinks } from "./entity-links-queries";

function linkKey(link: EntityLink) {
  return `${link.relation}:${link.target.kind}:${link.target.id}`;
}

function useRelationLabels(): Record<EntityLinkRelation, string> {
  const { t } = useTranslation("common");
  return {
    related: t("links.relation.related"),
    mentions: t("links.relation.mentions"),
    "mentioned-by": t("links.relation.mentioned-by"),
    blocks: t("links.relation.blocks"),
    "blocked-by": t("links.relation.blocked-by"),
    "duplicate-of": t("links.relation.duplicate-of"),
    "duplicated-by": t("links.relation.duplicated-by"),
    parent: t("links.relation.parent"),
    child: t("links.relation.child"),
    "worked-on-by": t("links.relation.worked-on-by"),
    "works-on": t("links.relation.works-on"),
  };
}

function useLinkRows(
  hostId: string,
  entity: EntityRef,
  hideLink?: (link: EntityLink) => boolean,
) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const relations = useRelationLabels();
  const { data = [] } = useEntityLinks(hostId, entity);
  return data
    .filter((link) => !hideLink?.(link))
    .map((link) => {
      const href = entityLinkHref(hostId, link.target);
      return {
        key: linkKey(link),
        testID: `linked-${link.target.kind}-${link.target.id}`,
        title: link.title || t("links.untitled"),
        detail: [relations[link.relation], link.detail]
          .filter(Boolean)
          .join(" · "),
        onPress: href ? () => router.push(href) : undefined,
      };
    });
}

export function LinkedEntitiesSection({
  hostId,
  entity,
  hideLink,
}: {
  hostId: string;
  entity: EntityRef;
  hideLink?: (link: EntityLink) => boolean;
}) {
  const { t } = useTranslation("common");
  const rows = useLinkRows(hostId, entity, hideLink);
  if (rows.length === 0) return null;
  return (
    <FormSection title={t("links.title")}>
      {rows.map((row) => (
        <FormRow
          key={row.key}
          testID={row.testID}
          onPress={row.onPress}
          supportingText={row.detail}
        >
          <UiText>{row.title}</UiText>
        </FormRow>
      ))}
    </FormSection>
  );
}

export function LinkedEntitiesList({
  hostId,
  entity,
}: {
  hostId: string;
  entity: EntityRef;
}) {
  const { t } = useTranslation("common");
  const colors = useThemeColors();
  const rows = useLinkRows(hostId, entity);
  if (rows.length === 0) return null;
  return (
    <View>
      <ListSectionHeader title={t("links.title")} />
      {rows.map((row, index) => (
        <View key={row.key}>
          {index > 0 ? <ListSeparator /> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={row.title}
            accessibilityValue={{ text: row.detail }}
            disabled={!row.onPress}
            onPress={row.onPress}
            testID={row.testID}
            style={({ pressed }) => [
              styles.row,
              pressed && { backgroundColor: colors.muted },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[styles.title, { color: colors.foreground }]}
            >
              {row.title}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.detail, { color: colors.mutedForeground }]}
            >
              {row.detail}
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 44,
    justifyContent: "center",
    gap: 2,
    paddingVertical: space.sm,
    paddingHorizontal: layout.sideMargin,
  },
  title: { fontSize: 16, lineHeight: 22 },
  detail: { fontSize: 13, lineHeight: 18 },
});
