import { hidePendingTableStart } from "@cocurdex/shared";
import { useRouter } from "expo-router";
import { memo, useCallback, useMemo, useState } from "react";
import { Linking, View } from "react-native";
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
import { preloadFileContent } from "@/workspace-files";
import { DocImage } from "./doc-image";
import { splitDocImages } from "./doc-image-segments";
import { entityLinkHref, entityLinkRef } from "./entity-link";
import { externalLinkUrl } from "./external-link";
import { FadeInBlock } from "./fade-in-block";
import { useExistingFiles } from "./file-link-queries";
import {
  collectFileLinkTargets,
  linkFilePaths,
  localFileLinkTarget,
  padInlineCode,
  parseFileLinkHref,
} from "./file-links";
import { splitMermaidBlocks } from "./markdown-segments";
import { MermaidDiagram } from "./mermaid-diagram";
import { MONO_FONT } from "./mono-font";
import { type StreamingBlock, streamingBlocks } from "./streaming-blocks";
import { useStreamingReveal } from "./use-streaming-reveal";

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
    h1: { ...block, fontSize: 22, lineHeight: 28, fontWeight: "600" },
    h2: { ...block, fontSize: 19, lineHeight: 26, fontWeight: "600" },
    h3: { ...block, fontSize: 17, lineHeight: 24, fontWeight: "500" },
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

function fileTargetOf(url: string, fileRoot: string | null | undefined) {
  return fileRoot === undefined
    ? parseFileLinkHref(url)
    : localFileLinkTarget(url, fileRoot);
}

function useOpenLink(
  hostId: string | undefined,
  fileRoot: string | null | undefined,
) {
  const router = useRouter();
  return useCallback(
    (url: string) => {
      const external = externalLinkUrl(url);
      if (external) {
        void Linking.openURL(external);
        return;
      }
      const file = hostId ? fileTargetOf(url, fileRoot) : null;
      if (file && hostId) {
        preloadFileContent(hostId, file.path);
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
    },
    [router, hostId, fileRoot],
  );
}

const MarkdownBlock = memo(function MarkdownBlock({
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
});

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

function SegmentView({
  block,
  style,
  hostId,
  onOpenLink,
}: {
  block: StreamingBlock;
  style: MarkdownStyle;
  hostId: string | undefined;
  onOpenLink(url: string): void;
}) {
  if (block.kind === "image") {
    return hostId ? (
      <DocImage hostId={hostId} fileName={block.fileName} alt={block.alt} />
    ) : null;
  }
  if (block.kind === "markdown") {
    return (
      <MarkdownBlock
        markdown={block.text}
        style={style}
        onOpenLink={onOpenLink}
      />
    );
  }
  return (
    <MermaidDiagram
      source={block.source}
      fallback={
        <MarkdownBlock
          markdown={`~~~~\n${block.source}\n~~~~`}
          style={style}
          onOpenLink={onOpenLink}
        />
      }
    />
  );
}

export function MarkdownText({
  markdown,
  streaming = false,
  hostId,
  fileRoot,
  testID,
}: {
  markdown: string;
  streaming?: boolean;
  hostId?: string;
  fileRoot?: string | null;
  testID?: string;
}) {
  const { content, live } = useStreamingReveal(markdown, streaming);
  const [split] = useState(streaming);
  const settled = live ? hidePendingTableStart(content) : content;
  const linked = useFileLinkedMarkdown(settled, hostId, fileRoot);
  const openLink = useOpenLink(hostId, fileRoot);
  const colors = useThemeColors();
  const syntaxColors = useSyntaxColors();
  const style = useMemo(
    () => markdownStyle(colors, syntaxColors),
    [colors, syntaxColors],
  );
  const blocks = useMemo(
    () =>
      streamingBlocks(
        splitDocImages(splitMermaidBlocks(padInlineCode(linked))),
        { live, split },
      ),
    [linked, live, split],
  );
  return (
    <View testID={testID} style={{ gap: space.sm }}>
      {blocks.map((block) => (
        <FadeInBlock key={block.key} fade={live}>
          <SegmentView
            block={block}
            style={style}
            hostId={hostId}
            onOpenLink={openLink}
          />
        </FadeInBlock>
      ))}
    </View>
  );
}
