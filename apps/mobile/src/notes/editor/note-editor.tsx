import { parseDocImageUri } from "@cocurdex/shared";
import { useRouter } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { type ComponentRef, useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, PixelRatio, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { useOpenLink } from "@/markdown";
import { type ThemeColors, useThemeColors } from "@/theme";
import { useBottomKeyboardOverlap, useOptionSheet } from "@/ui";
import type { NoteDocSession } from "./note-doc-session";
import {
  type NoteBlockStyle,
  type NoteEditorCommand,
  type NoteEditorFormatState,
  type NoteEditorInbound,
  type NoteInsertKind,
  noteEditorScript,
  parseNoteEditorMessage,
} from "./note-editor-protocol";
import { NOTE_EDITOR_RUNTIME_HTML } from "./note-editor-runtime.generated";
import { NoteFormatBar } from "./note-format-bar";

type EditorWebView = ComponentRef<typeof WebView>;

const BLOCK_STYLES: readonly NoteBlockStyle[] = [
  "paragraph",
  "heading1",
  "heading2",
  "heading3",
  "blockquote",
  "codeBlock",
];

type InsertChoice =
  | { name: "block"; style: NoteBlockStyle }
  | { name: "insert"; kind: NoteInsertKind };

const INSERT_CHOICES: readonly InsertChoice[] = [
  { name: "block", style: "heading1" },
  { name: "block", style: "heading2" },
  { name: "block", style: "heading3" },
  { name: "insert", kind: "bulletList" },
  { name: "insert", kind: "orderedList" },
  { name: "insert", kind: "taskList" },
  { name: "block", style: "blockquote" },
  { name: "block", style: "codeBlock" },
  { name: "insert", kind: "horizontalRule" },
  { name: "insert", kind: "table" },
];

function editorTheme(colors: ThemeColors) {
  return {
    colors: {
      background: colors.background,
      foreground: colors.foreground,
      "muted-foreground": colors.mutedForeground,
      muted: colors.muted,
      border: colors.border,
      tint: colors.tint,
      "brand-mark": colors.brandMark,
    },
    fontScale: PixelRatio.getFontScale(),
  };
}

function insertKey(choice: InsertChoice) {
  return choice.name === "block" ? choice.style : choice.kind;
}

export function NoteEditor({
  hostId,
  session,
  title,
  meta,
  focusTitle,
  editable,
  onTitle,
  onProperties,
  onFocusChange,
}: {
  hostId: string;
  session: NoteDocSession;
  title: string;
  meta: string;
  focusTitle: boolean;
  editable: boolean;
  onTitle(title: string): void;
  onProperties(): void;
  onFocusChange(focused: boolean): void;
}) {
  const { t } = useTranslation("notes");
  const colors = useThemeColors();
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const keyboardShown = useBottomKeyboardOverlap() > 0;
  const bottomInset = useSafeAreaInsets().bottom;
  const openLink = useOpenLink(hostId, undefined);
  const optionSheet = useOptionSheet();
  const webView = useRef<EditorWebView | null>(null);
  const sentMeta = useRef(meta);
  const [focused, setFocused] = useState(false);
  const [format, setFormat] = useState<NoteEditorFormatState | null>(null);

  const send = (message: NoteEditorInbound) =>
    webView.current?.injectJavaScript(noteEditorScript(message));
  const run = (command: NoteEditorCommand) =>
    send({ type: "command", command });

  if (sentMeta.current !== meta) {
    sentMeta.current = meta;
    send({ type: "meta", meta });
  }

  const blockLabels: Record<NoteBlockStyle, string> = {
    paragraph: t("editor.block.paragraph"),
    heading1: t("editor.block.heading1"),
    heading2: t("editor.block.heading2"),
    heading3: t("editor.block.heading3"),
    blockquote: t("editor.block.blockquote"),
    codeBlock: t("editor.block.codeBlock"),
  };
  const insertLabels: Record<NoteInsertKind, string> = {
    bulletList: t("editor.insert.bulletList"),
    orderedList: t("editor.insert.orderedList"),
    taskList: t("editor.insert.taskList"),
    horizontalRule: t("editor.insert.horizontalRule"),
    table: t("editor.insert.table"),
  };
  const insertLabel = (choice: InsertChoice) =>
    choice.name === "block"
      ? blockLabels[choice.style]
      : insertLabels[choice.kind];

  const openBlockStyles = () =>
    optionSheet.open({
      title: t("editor.format.text"),
      items: BLOCK_STYLES.map((style) => ({
        key: style,
        label: blockLabels[style],
        selected: format?.block === style,
        testID: `note-block-${style}`,
        onPress: () => run({ name: "block", style }),
      })),
    });

  const openInsert = (fromSlash: boolean) =>
    optionSheet.open({
      title: t("editor.format.insert"),
      items: INSERT_CHOICES.map((choice) => ({
        key: insertKey(choice),
        label: insertLabel(choice),
        testID: `note-insert-${insertKey(choice)}`,
        onPress: () => run({ ...choice, fromSlash }),
      })),
    });

  const handleMessage = ({ nativeEvent }: WebViewMessageEvent) => {
    const message = parseNoteEditorMessage(nativeEvent.data);
    if (!message) return;
    switch (message.type) {
      case "ready":
        if (focusTitle && editable) webView.current?.requestFocus();
        send({
          type: "init",
          state: session.state(),
          title,
          meta: sentMeta.current,
          titlePlaceholder: t("editor.titlePlaceholder"),
          bodyPlaceholder: t("editor.bodyPlaceholder"),
          theme: editorTheme(colors),
          focusTitle,
          editable,
        });
        return;
      case "update":
        session.applyLocal(message.update);
        return;
      case "title":
        onTitle(message.title);
        return;
      case "focus":
        setFocused(message.focused);
        onFocusChange(message.focused);
        return;
      case "format":
        setFormat(message.format);
        return;
      case "slash":
        openInsert(true);
        return;
      case "properties":
        onProperties();
        return;
      case "openLink":
        openLink(message.href);
        return;
      case "openImage": {
        const fileName = parseDocImageUri(message.src);
        if (!fileName) return;
        router.push({
          pathname: "/image/[hostId]",
          params: { hostId, filePath: fileName, name: message.alt || fileName },
        });
        return;
      }
    }
  };

  const attach = useCallback(
    (view: EditorWebView | null): (() => void) | undefined => {
      webView.current = view;
      if (!view) return undefined;
      const stopRemote = session.onRemoteUpdate((update) =>
        view.injectJavaScript(noteEditorScript({ type: "remote", update })),
      );
      return () => {
        stopRemote();
        webView.current = null;
      };
    },
    [session],
  );

  return (
    <KeyboardAvoidingView
      style={[styles.fill, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
    >
      <WebView
        ref={attach}
        testID="note-editor"
        source={{ html: NOTE_EDITOR_RUNTIME_HTML }}
        originWhitelist={["about:blank"]}
        onShouldStartLoadWithRequest={({ url }) => url === "about:blank"}
        onMessage={handleMessage}
        setSupportMultipleWindows={false}
        allowsLinkPreview={false}
        hideKeyboardAccessoryView
        keyboardDisplayRequiresUserAction={false}
        textZoom={100}
        style={[styles.fill, { backgroundColor: colors.background }]}
      />
      {focused ? (
        <NoteFormatBar
          format={format}
          bottomInset={keyboardShown ? 0 : bottomInset}
          onBlockStyle={openBlockStyles}
          onBold={() => run({ name: "mark", mark: "bold" })}
          onBulletList={() => run({ name: "list", kind: "bulletList" })}
          onTaskList={() => run({ name: "list", kind: "taskList" })}
          onInsert={() => openInsert(false)}
          onHideKeyboard={() => run({ name: "blur" })}
        />
      ) : null}
      {optionSheet.sheet}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
