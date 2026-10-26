const MIN_CHARS_PER_SECOND = 90;
const COMFORTABLE_CHARS_PER_SECOND = 250;
const CATCH_UP_MS = 600;
const MAX_LAG_MS = 3_000;

function isHighSurrogate(code: number) {
  return code >= 0xd800 && code <= 0xdbff;
}

function getCharsPerSecond(backlog: number) {
  const comfortable = Math.min(
    COMFORTABLE_CHARS_PER_SECOND,
    (backlog * 1000) / CATCH_UP_MS,
  );
  const bounded = (backlog * 1000) / MAX_LAG_MS;
  return Math.max(MIN_CHARS_PER_SECOND, comfortable, bounded);
}

export function getNextRevealLength(
  content: string,
  revealed: number,
  elapsedMs: number,
) {
  const backlog = content.length - revealed;
  if (backlog <= 0) {
    return content.length;
  }
  const step = Math.max(
    1,
    Math.round((getCharsPerSecond(backlog) * elapsedMs) / 1000),
  );
  let next = Math.min(content.length, revealed + step);
  if (next < content.length && isHighSurrogate(content.charCodeAt(next - 1))) {
    next += 1;
  }
  return next;
}

const FENCE = /^\s*(```|~~~)/;
const TABLE_ROW = /^\s*\|/;
const TABLE_DELIMITER = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

function isInsideOpenFence(lines: string[]) {
  return lines.filter((line) => FENCE.test(line)).length % 2 === 1;
}

export function hidePendingTableStart(content: string) {
  const lines = content.split("\n");
  const scanEnd = lines.at(-1) === "" ? lines.length - 1 : lines.length;
  let start = scanEnd;
  while (start > 0 && TABLE_ROW.test(lines[start - 1])) {
    start -= 1;
  }
  if (start === scanEnd || isInsideOpenFence(lines.slice(0, start))) {
    return content;
  }
  const delimiterIndex = start + 1;
  const hasCompleteDelimiter =
    delimiterIndex < lines.length - 1 &&
    TABLE_DELIMITER.test(lines[delimiterIndex]);
  if (hasCompleteDelimiter) {
    return content;
  }
  return lines.slice(0, start).join("\n");
}
