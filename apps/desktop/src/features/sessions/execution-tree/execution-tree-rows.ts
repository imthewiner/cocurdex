import type {
  ExecutionInteraction,
  ExecutionRunNode,
  ExecutionSessionNode,
  ExecutionToolCallNode,
  RunRecord,
  SessionExecutionTree,
} from "@cocurdex/shared";

export type ExecutionTreeRow =
  | { kind: "session"; key: string; depth: number; node: ExecutionSessionNode }
  | { kind: "run"; key: string; depth: number; run: RunRecord }
  | {
      kind: "toolCall";
      key: string;
      depth: number;
      node: ExecutionToolCallNode;
    }
  | {
      kind: "interaction";
      key: string;
      depth: number;
      interaction: ExecutionInteraction;
    }
  | { kind: "truncated"; key: string; depth: number };

function interactionRows(
  interactions: ExecutionInteraction[],
  depth: number,
): ExecutionTreeRow[] {
  return interactions.map((interaction) => ({
    kind: "interaction",
    key: `interaction:${interaction.record.id}`,
    depth,
    interaction,
  }));
}

function toolCallRows(
  node: ExecutionToolCallNode,
  depth: number,
): ExecutionTreeRow[] {
  const row: ExecutionTreeRow = {
    kind: "toolCall",
    key: `tool:${node.toolCall.id}`,
    depth,
    node,
  };
  return node.child ? [row, ...sessionRows(node.child, depth + 1)] : [row];
}

function runRows(node: ExecutionRunNode, depth: number): ExecutionTreeRow[] {
  return [
    { kind: "run", key: `run:${node.run.id}`, depth, run: node.run },
    ...node.toolCalls.flatMap((toolCall) => toolCallRows(toolCall, depth + 1)),
    ...node.delegated.flatMap((child) => sessionRows(child, depth + 1)),
    ...interactionRows(node.interactions, depth + 1),
  ];
}

function sessionRows(
  node: ExecutionSessionNode,
  depth: number,
): ExecutionTreeRow[] {
  const truncated: ExecutionTreeRow[] = node.truncated
    ? [
        {
          kind: "truncated",
          key: `truncated:${node.session.id}`,
          depth: depth + 1,
        },
      ]
    : [];
  return [
    { kind: "session", key: `session:${node.session.id}`, depth, node },
    ...node.runs.flatMap((run) => runRows(run, depth + 1)),
    ...node.toolCalls.flatMap((toolCall) => toolCallRows(toolCall, depth + 1)),
    ...node.children.flatMap((child) => sessionRows(child, depth + 1)),
    ...interactionRows(node.interactions, depth + 1),
    ...truncated,
  ];
}

export function flattenExecutionTree(
  tree: SessionExecutionTree,
): ExecutionTreeRow[] {
  return sessionRows(tree.root, 0);
}
