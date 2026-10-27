import { height } from "@expo/ui/jetpack-compose/modifiers";

const SINGLE_LINE = [height(48)];
const TWO_LINE = [height(64)];

export function sheetRowModifiers(twoLine: boolean) {
  return twoLine ? TWO_LINE : SINGLE_LINE;
}
