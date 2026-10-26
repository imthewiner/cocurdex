import type {
  SessionRuntimeAxes,
  SessionRuntimeSelection,
} from "@cocurdex/shared";
import { Text } from "@expo/ui";
import { useThemeColors } from "@/theme";
import { FormRow, FormSection, SelectedMark } from "@/ui";
import {
  effortChoiceLabel,
  thinkingOptionLabel,
  useRuntimeLabels,
} from "./runtime-labels";

interface Choice {
  key: string;
  label: string;
  supporting?: string | null;
  selected: boolean;
  onPress(): void;
}

function ChoiceSection({
  title,
  testIDPrefix,
  choices,
}: {
  title: string;
  testIDPrefix: string;
  choices: readonly Choice[];
}) {
  const colors = useThemeColors();
  return (
    <FormSection title={title}>
      {choices.map((choice) => (
        <FormRow
          key={choice.key}
          testID={`${testIDPrefix}-${choice.key}`}
          onPress={choice.onPress}
          supportingText={
            choice.supporting ? (
              <Text textStyle={{ color: colors.mutedForeground }}>
                {choice.supporting}
              </Text>
            ) : undefined
          }
          trailing={<SelectedMark selected={choice.selected} />}
        >
          <Text>{choice.label}</Text>
        </FormRow>
      ))}
    </FormSection>
  );
}

export function RuntimeSections({
  axes,
  onChange,
}: {
  axes: SessionRuntimeAxes;
  onChange(patch: SessionRuntimeSelection): void;
}) {
  const labels = useRuntimeLabels();
  const { thinking, effort, speed, fastMode, openCode } = axes;
  return (
    <>
      {thinking ? (
        <ChoiceSection
          title={labels.thinking}
          testIDPrefix="runtime-thinking"
          choices={thinking.options.map((option) => ({
            key: option.level,
            label: thinkingOptionLabel(option, labels),
            supporting: option.description,
            selected: option.level === thinking.selected,
            onPress: () => onChange({ thinkingLevel: option.level }),
          }))}
        />
      ) : null}
      {effort ? (
        <ChoiceSection
          title={labels.thinking}
          testIDPrefix="runtime-effort"
          choices={effort.options.map((option) => ({
            key: option.effort,
            label: effortChoiceLabel(option, labels),
            supporting: option.description,
            selected: option.effort === effort.selected,
            onPress: () => onChange({ reasoningEffort: option.effort }),
          }))}
        />
      ) : null}
      {speed ? (
        <ChoiceSection
          title={labels.speed}
          testIDPrefix="runtime-speed"
          choices={[
            {
              key: "standard",
              label: labels.standard,
              selected: speed.selected === null,
              onPress: () => onChange({ serviceTier: null }),
            },
            ...speed.tiers.map((tier) => ({
              key: tier.id,
              label: tier.name,
              supporting: tier.description,
              selected: tier.id === speed.selected,
              onPress: () => onChange({ serviceTier: tier.id }),
            })),
          ]}
        />
      ) : null}
      {fastMode === null ? null : (
        <ChoiceSection
          title={labels.fastMode}
          testIDPrefix="runtime-fast"
          choices={[true, false].map((on) => ({
            key: on ? "on" : "off",
            label: on ? labels.on : labels.off,
            selected: fastMode === on,
            onPress: () => onChange({ fastMode: on }),
          }))}
        />
      )}
      {openCode && openCode.agents.length > 0 ? (
        <ChoiceSection
          title={labels.openCodeAgent}
          testIDPrefix="runtime-opencode-agent"
          choices={openCode.agents.map((agent) => ({
            key: agent,
            label: agent,
            selected: agent === openCode.agent,
            onPress: () => onChange({ openCodeAgent: agent }),
          }))}
        />
      ) : null}
      {openCode && openCode.variants.length > 0 ? (
        <ChoiceSection
          title={labels.openCodeVariant}
          testIDPrefix="runtime-opencode-variant"
          choices={[
            {
              key: "default",
              label: labels.defaultValue,
              selected: openCode.variant === "",
              onPress: () => onChange({ openCodeVariant: null }),
            },
            ...openCode.variants.map((variant) => ({
              key: variant,
              label: variant,
              selected: variant === openCode.variant,
              onPress: () => onChange({ openCodeVariant: variant }),
            })),
          ]}
        />
      ) : null}
    </>
  );
}
