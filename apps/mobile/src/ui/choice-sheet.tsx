import { ListSheet } from "./list-sheet";

export interface Choice {
  value: string;
  label: string;
}

export function ChoiceSheet({
  title,
  choices,
  selected,
  onSelect,
  onDismiss,
  testID,
}: {
  title: string | null;
  choices: readonly Choice[];
  selected: string | null;
  onSelect(value: string): void;
  onDismiss(): void;
  testID?: string;
}) {
  return (
    <ListSheet
      presented={title !== null}
      title={title ?? ""}
      items={choices.map((choice) => ({
        key: choice.value,
        label: choice.label,
        selected: choice.value === selected,
        onPress: () => {
          onSelect(choice.value);
          onDismiss();
        },
      }))}
      onDismiss={onDismiss}
      testID={testID}
    />
  );
}
