import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Linking, Platform, View } from "react-native";
import {
  EnrichedMarkdownText,
  type MarkdownStyle,
} from "react-native-enriched-markdown";
import {
  type SyntaxColors,
  space,
  type ThemeColors,
  useSyntaxColors,
  useThemeColors,
} from "@/theme";
import { entityLinkHref, entityLinkRef } from "./entity-link";
import { externalLinkUrl } from "./external-link";
import { useExistingFiles } from "./file-link-queries";
import {
  collectFileLinkTargets,
  linkFilePaths,
  padInlineCode,
  parseFileLinkHref,
} from "./file-links";
import { splitMermaidBlocks } from "./markdown-segments";
import { MermaidDiagram } from "./mermaid-diagram";

export const MONO_FONT = Platform.select({
  ios: "Menlo",
  default: "monospace",
});
const BODY_SIZE = 16;
const BODY_LINE_HEIGHT = 24;

function markdownStyle(
  colors: ThemeColors,
  syntaxColors: SyntaxColors,
): MarkdownStyle {
  const block = {
    fontSize: BODY_SIZE,
    lineHeight: BODY_LINE_HEIGHT,
    color: colors.foreground,
    marginBottom: space.sm,
  };
  return {
    paragraph: block,
    list: { ...block, bulletColor: colors.mutedForeground },
    h1: { ...block, fontSize: 22, lineHeight: 28, fontWeight: "700" },
    h2: { ...block, fontSize: 19, lineHeight: 26, fontWeight: "700" },
    h3: { ...block, fontSize: 17, lineHeight: 24, fontWeight: "600" },
    blockquote: {
      ...block,
      color: colors.mutedForeground,
      borderColor: colors.border,
      borderWidth: 3,
      gapWidth: space.md,
    },
    link: { color: colors.chatLink, underline: false },
    code: {
      fontFamily: MONO_FONT,
      fontSize: 14,
      color: colors.foreground,
      backgroundColor: colors.chatCodeInline,
      borderColor: colors.chatCodeInline,
    },
    codeBlock: {
      fontFamily: MONO_FONT,
      fontSize: 13,
      lineHeight: 19,
      color: colors.foreground,
      backgroundColor: colors.chatCodeBlock,
      borderColor: colors.chatBorder,
      borderWidth: 1,
      borderRadius: 8,
      padding: space.md,
      marginBottom: space.sm,
      syntaxColors,
    },
    table: {
      fontSize: 14,
      color: colors.foreground,
      borderColor: colors.chatBorder,
      headerBackgroundColor: colors.muted,
      headerTextColor: colors.foreground,
      rowEvenBackgroundColor: colors.background,
      rowOddBackgroundColor: colors.muted,
      borderRadius: 8,
      marginBottom: space.sm,
    },
    taskList: {
      checkedColor: colors.tint,
      borderColor: colors.mutedForeground,
      checkmarkColor: colors.primaryForeground,
      checkedTextColor: colors.mutedForeground,
      checkedStrikethrough: true,
      checkboxSize: 18,
      checkboxBorderRadius: 9,
    },
    thematicBreak: { color: colors.border },
  };
}

function useOpenLink(hostId: string | undefined) {
  const router = useRouter();
  return (url: string) => {
    const external = externalLinkUrl(url);
    if (external) {
      void Linking.openURL(external);
      return;
    }
    const file = hostId ? parseFileLinkHref(url) : null;
    if (file && hostId) {
      router.push({
        pathname: "/file/[hostId]",
        params: {
          hostId,
          path: file.path,
          ...(file.line === null ? {} : { line: String(file.line) }),
        },
      });
      return;
    }
    const ref = entityLinkRef(url);
    const href = ref && hostId ? entityLinkHref(hostId, ref) : null;
    if (href) router.push(href);
  };
}

function MarkdownBlock({
  markdown,
  style,
  onOpenLink,
}: {
  markdown: string;
  style: MarkdownStyle;
  onOpenLink(url: string): void;
}) {
  return (
    <EnrichedMarkdownText
      markdown={markdown}
      flavor="github"
      markdownStyle={style}
      selectable
      enableTaskListItemToggle={false}
      onLinkPress={({ url }) => onOpenLink(url)}
    />
  );
}

function useFileLinkedMarkdown(
  markdown: string,
  hostId: string | undefined,
  fileRoot: string | null | undefined,
) {
  const linkable = hostId !== undefined && fileRoot !== undefined;
  const paths = useMemo(
    () =>
      linkable
        ? collectFileLinkTargets(markdown, fileRoot).map(
            (target) => target.path,
          )
        : [],
    [linkable, markdown, fileRoot],
  );
  const existing = useExistingFiles(hostId, paths);
  return useMemo(
    () => (linkable ? linkFilePaths(markdown, fileRoot, existing) : markdown),
    [linkable, markdown, fileRoot, existing],
  );
}

export function MarkdownText({
  markdown,
  hostId,
  fileRoot,
  testID,
}: {
  markdown: string;
  hostId?: string;
  fileRoot?: string | null;
  testID?: string;
}) {
  const linked = useFileLinkedMarkdown(markdown, hostId, fileRoot);
  const openLink = useOpenLink(hostId);
  const colors = useThemeColors();
  const syntaxColors = useSyntaxColors();
  const style = useMemo(
    () => markdownStyle(colors, syntaxColors),
    [colors, syntaxColors],
  );
  const segments = useMemo(
    () => splitMermaidBlocks(padInlineCode(linked)),
    [linked],
  );
  return (
    <View testID={testID}>
      {segments.map((segment) =>
        segment.kind === "markdown" ? (
          <MarkdownBlock
            key={`markdown-${segment.line}`}
            markdown={segment.text}
            style={style}
            onOpenLink={openLink}
          />
        ) : (
          <MermaidDiagram
            key={`mermaid-${segment.line}`}
            source={segment.source}
            fallback={
              <MarkdownBlock
                markdown={`~~~~\n${segment.source}\n~~~~`}
                style={style}
                onOpenLink={openLink}
              />
            }
          />
        ),
      )}
    </View>
  );
}
