import { type ReactElement, useRef } from "react";
import {
  FlatList,
  type ListRenderItemInfo,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MONO_FONT } from "@/markdown";
import { layout, space, useThemeColors } from "@/theme";
import {
  type SourceScheme,
  type SourceTokens,
  useSourceTokens,
} from "./source-highlight";

const FONT_STYLE_ITALIC = 1;
const FONT_STYLE_BOLD = 2;

function SourceLine({
  index,
  line,
  tokens,
  digits,
  focused,
}: {
  index: number;
  line: string;
  tokens: SourceTokens[number] | undefined;
  digits: number;
  focused: boolean;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={[styles.line, focused && { backgroundColor: colors.muted }]}
      testID={focused ? "source-focused-line" : undefined}
    >
      <Text
        style={[
          styles.number,
          { width: digits * 8 + space.sm, color: colors.mutedForeground },
        ]}
      >
        {index + 1}
      </Text>
      <Text selectable style={[styles.code, { color: colors.foreground }]}>
        {tokens
          ? tokens.map((token, at) => (
              <Text
                // biome-ignore lint/suspicious/noArrayIndexKey: tokens are positional within a fixed line
                key={at}
                style={{
                  color: token.color,
                  fontStyle:
                    (token.fontStyle ?? 0) & FONT_STYLE_ITALIC
                      ? "italic"
                      : "normal",
                  fontWeight:
                    (token.fontStyle ?? 0) & FONT_STYLE_BOLD ? "600" : "400",
                }}
              >
                {token.content}
              </Text>
            ))
          : line || " "}
      </Text>
    </View>
  );
}

export function SourceView({
  fileKey,
  lines,
  language,
  scheme,
  focusLine,
  footer,
}: {
  fileKey: string;
  lines: readonly string[];
  language: string | null;
  scheme: SourceScheme;
  focusLine: number | null;
  footer?: ReactElement | null;
}) {
  const tokens = useSourceTokens(fileKey, lines, language, scheme);
  const list = useRef<FlatList<string>>(null);
  const revealed = useRef(false);
  const digits = String(lines.length).length;
  const focusIndex =
    focusLine !== null && focusLine >= 1 && focusLine <= lines.length
      ? focusLine - 1
      : null;

  const reveal = () => {
    if (revealed.current || focusIndex === null) return;
    revealed.current = true;
    list.current?.scrollToIndex({
      index: focusIndex,
      viewPosition: 0.3,
      animated: false,
    });
  };

  return (
    <FlatList
      ref={list}
      data={lines as string[]}
      extraData={tokens}
      keyExtractor={(_line, index) => String(index)}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      initialNumToRender={focusIndex === null ? 40 : focusIndex + 20}
      onContentSizeChange={reveal}
      onScrollToIndexFailed={({ index, averageItemLength }) => {
        list.current?.scrollToOffset({
          offset: index * averageItemLength,
          animated: false,
        });
        setTimeout(
          () =>
            list.current?.scrollToIndex({
              index,
              viewPosition: 0.3,
              animated: false,
            }),
          50,
        );
      }}
      ListFooterComponent={footer ?? undefined}
      renderItem={({ item, index }: ListRenderItemInfo<string>) => (
        <SourceLine
          index={index}
          line={item}
          tokens={tokens[index]}
          digits={digits}
          focused={index === focusIndex}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: space.sm },
  line: {
    flexDirection: "row",
    paddingRight: layout.sideMargin,
    paddingLeft: space.sm,
  },
  number: {
    fontFamily: MONO_FONT,
    fontSize: 12,
    lineHeight: 20,
    textAlign: "right",
    marginRight: space.md,
  },
  code: { flex: 1, fontFamily: MONO_FONT, fontSize: 13, lineHeight: 20 },
});
