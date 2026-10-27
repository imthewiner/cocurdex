import { memo, type ReactElement, useMemo, useRef, useState } from "react";
import {
  FlatList,
  type ListRenderItemInfo,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { MONO_FONT } from "@/markdown";
import { layout, space, useThemeColors } from "@/theme";
import { useScrollIndicatorWhileScrolling } from "@/ui";
import { expandTabs, sourceColumns } from "./source-columns";
import {
  type SourceScheme,
  type SourceTokens,
  useSourceTokens,
} from "./source-highlight";

const FONT_STYLE_ITALIC = 1;
const FONT_STYLE_BOLD = 2;
const LINES_ABOVE_FOCUS = 40;
const LINES_PER_PREPEND = 200;
const LINES_BELOW_FIRST_SCREEN = 40;
const FOCUS_VIEW_POSITION = 0.3;
const LINE_HEIGHT = 20;
const LINES_HIGHLIGHTED_AHEAD = 80;
const WINDOW_SCREENS = 5;
const CODE_FONT_SIZE = 13;
const CHAR_WIDTH = CODE_FONT_SIZE * 0.61;
const MAX_COLUMNS = 400;
const GUTTER_DIGIT_WIDTH = 8;

function gutterWidth(digits: number) {
  return digits * GUTTER_DIGIT_WIDTH + space.sm;
}

const SourceLine = memo(function SourceLine({
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
          { width: gutterWidth(digits), color: colors.mutedForeground },
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
                {expandTabs(token.content)}
              </Text>
            ))
          : expandTabs(line) || " "}
      </Text>
    </View>
  );
});

function firstRenderedLine(focusIndex: number | null) {
  return focusIndex === null ? 0 : Math.max(0, focusIndex - LINES_ABOVE_FOCUS);
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
  const scrollIndicator = useScrollIndicatorWhileScrolling();
  const { tokens, request } = useSourceTokens(fileKey, lines, language, scheme);
  const list = useRef<FlatList<string>>(null);
  const revealed = useRef(false);
  const digits = String(lines.length).length;
  const { width: windowWidth } = useWindowDimensions();
  const columns = useMemo(
    () => Math.min(sourceColumns(lines), MAX_COLUMNS),
    [lines],
  );
  const contentWidth = Math.max(
    windowWidth,
    Math.ceil(
      space.sm +
        gutterWidth(digits) +
        space.md +
        columns * CHAR_WIDTH +
        layout.sideMargin,
    ),
  );
  const focusIndex =
    focusLine !== null && focusLine >= 1 && focusLine <= lines.length
      ? focusLine - 1
      : null;

  const [firstLine, setFirstLine] = useState(() =>
    firstRenderedLine(focusIndex),
  );
  const rendered = useMemo(
    () => (firstLine === 0 ? lines : lines.slice(firstLine)),
    [lines, firstLine],
  );
  const focusRow = focusIndex === null ? null : focusIndex - firstLine;

  const scrollToFocus = (row: number) =>
    list.current?.scrollToIndex({
      index: row,
      viewPosition: FOCUS_VIEW_POSITION,
      animated: false,
    });

  const reveal = () => {
    if (revealed.current || focusRow === null) return;
    revealed.current = true;
    scrollToFocus(focusRow);
  };

  const highlightThrough = (offset: number, viewport: number) =>
    request(
      firstLine +
        Math.ceil((offset + viewport) / LINE_HEIGHT) +
        LINES_HIGHLIGHTED_AHEAD,
    );

  const prependEarlierLines = () => {
    if (!revealed.current || firstLine === 0) return;
    setFirstLine(Math.max(0, firstLine - LINES_PER_PREPEND));
  };

  return (
    <ScrollView
      horizontal
      directionalLockEnabled
      showsHorizontalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never"
      testID="source-horizontal-scroll"
    >
      <FlatList
        {...scrollIndicator}
        ref={list}
        style={{ width: contentWidth }}
        data={rendered as string[]}
        extraData={tokens}
        keyExtractor={(_line, row) => String(firstLine + row)}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        scrollsChildToFocus={false}
        initialNumToRender={(focusRow ?? 0) + LINES_BELOW_FIRST_SCREEN}
        windowSize={WINDOW_SCREENS}
        maintainVisibleContentPosition={
          firstLine > 0 ? { minIndexForVisible: 0 } : undefined
        }
        onStartReached={prependEarlierLines}
        onContentSizeChange={() => {
          reveal();
          request(
            (focusIndex ?? 0) +
              LINES_BELOW_FIRST_SCREEN +
              LINES_HIGHLIGHTED_AHEAD,
          );
        }}
        onScroll={({ nativeEvent }) =>
          highlightThrough(
            nativeEvent.contentOffset.y,
            nativeEvent.layoutMeasurement.height,
          )
        }
        scrollEventThrottle={100}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          list.current?.scrollToOffset({
            offset: index * averageItemLength,
            animated: false,
          });
          requestAnimationFrame(() => scrollToFocus(index));
        }}
        ListFooterComponent={footer ?? undefined}
        renderItem={({ item, index: row }: ListRenderItemInfo<string>) => {
          const index = firstLine + row;
          return (
            <SourceLine
              index={index}
              line={item}
              tokens={tokens[index]}
              digits={digits}
              focused={index === focusIndex}
            />
          );
        }}
      />
    </ScrollView>
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
    lineHeight: LINE_HEIGHT,
    textAlign: "right",
    marginRight: space.md,
  },
  code: {
    flex: 1,
    fontFamily: MONO_FONT,
    fontSize: CODE_FONT_SIZE,
    lineHeight: LINE_HEIGHT,
  },
});
