import type {
  ExecutionInteraction,
  ExecutionRunNode,
  ExecutionSessionNode,
  ExecutionToolCallNode,
  RunRecord,
  SessionExecutionTree,
} from "@cocurdex/shared";

export interface ExecutionRunSummary {
  toolCount: number;
  failedCount: number;
  waitingCount: number;
}

export type ExecutionTreeRow =
  | { kind: "session"; key: string; depth: number; node: ExecutionSessionNode }
  | {
      kind: "run";
      key: string;
      depth: number;
      run: RunRecord;
      summary: ExecutionRunSummary;
      expanded: boolean;
    }
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

export interface ExecutionTreeView {
  runExpansion: ReadonlyMap<string, boolean>;
  issuesOnly: boolean;
}

export const DEFAULT_EXECUTION_TREE_VIEW: ExecutionTreeView = {
  runExpansion: new Map(),
  issuesOnly: false,
};

function isFailedToolCall(node: ExecutionToolCallNode) {
  return node.toolCall.status === "failed";
}

function sessionHasIssues(node: ExecutionSessionNode): boolean {
  return (
    node.interactions.length > 0 ||
    node.runs.some(runHasIssues) ||
    node.toolCalls.some(toolCallHasIssues) ||
    node.children.some(sessionHasIssues)
  );
}

function toolCallHasIssues(node: ExecutionToolCallNode): boolean {
  return (
    isFailedToolCall(node) ||
    (node.child ? sessionHasIssues(node.child) : false)
  );
}

function runHasIssues(node: ExecutionRunNode): boolean {
  return (
    node.run.status === "failed" ||
    node.interactions.length > 0 ||
    node.toolCalls.some(toolCallHasIssues) ||
    node.delegated.some(sessionHasIssues)
  );
}

export function summarizeRun(node: ExecutionRunNode): ExecutionRunSummary {
  return {
    toolCount: node.toolCalls.length,
    failedCount: node.toolCalls.filter(isFailedToolCall).length,
    waitingCount: node.interactions.length,
  };
}

function isRunExpandedByDefault(node: ExecutionRunNode, isLatest: boolean) {
  return (
    isLatest || node.run.status === "running" || node.interactions.length > 0
  );
}

class RowBuilder {
  constructor(private readonly view: ExecutionTreeView) {}

  session(node: ExecutionSessionNode, depth: number): ExecutionTreeRow[] {
    const { issuesOnly } = this.view;
    const truncated: ExecutionTreeRow[] = node.truncated
      ? [
          {
            kind: "truncated",
            key: `truncated:${node.session.id}`,
            depth: depth + 1,
          },
        ]
      : [];
    const runs = issuesOnly ? node.runs.filter(runHasIssues) : node.runs;
    const latestRunId = node.runs.at(-1)?.run.id;
    return [
      { kind: "session", key: `session:${node.session.id}`, depth, node },
      ...runs.flatMap((run) =>
        this.run(run, depth + 1, run.run.id === latestRunId),
      ),
      ...this.toolCalls(node.toolCalls, depth + 1),
      ...this.sessions(node.children, depth + 1),
      ...interactionRows(node.interactions, depth + 1),
      ...truncated,
    ];
  }

  private sessions(nodes: ExecutionSessionNode[], depth: number) {
    const visible = this.view.issuesOnly
      ? nodes.filter(sessionHasIssues)
      : nodes;
    return visible.flatMap((child) => this.session(child, depth));
  }

  private toolCalls(nodes: ExecutionToolCallNode[], depth: number) {
    const visible = this.view.issuesOnly
      ? nodes.filter(toolCallHasIssues)
      : nodes;
    return visible.flatMap((node) => this.toolCall(node, depth));
  }

  private toolCall(
    node: ExecutionToolCallNode,
    depth: number,
  ): ExecutionTreeRow[] {
    const row: ExecutionTreeRow = {
      kind: "toolCall",
      key: `tool:${node.toolCall.id}`,
      depth,
      node,
    };
    return node.child ? [row, ...this.session(node.child, depth + 1)] : [row];
  }

  private run(
    node: ExecutionRunNode,
    depth: number,
    isLatest: boolean,
  ): ExecutionTreeRow[] {
    const expanded =
      this.view.issuesOnly ||
      (this.view.runExpansion.get(node.run.id) ??
        isRunExpandedByDefault(node, isLatest));
    const row: ExecutionTreeRow = {
      kind: "run",
      key: `run:${node.run.id}`,
      depth,
      run: node.run,
      summary: summarizeRun(node),
      expanded,
    };
    if (!expanded) return [row];
    return [
      row,
      ...this.toolCalls(node.toolCalls, depth + 1),
      ...this.sessions(node.delegated, depth + 1),
      ...interactionRows(node.interactions, depth + 1),
    ];
  }
}

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

export function flattenExecutionTree(
  tree: SessionExecutionTree,
  view: ExecutionTreeView = DEFAULT_EXECUTION_TREE_VIEW,
): ExecutionTreeRow[] {
  return new RowBuilder(view).session(tree.root, 0);
}

export function toggleRunExpansion(
  runExpansion: ReadonlyMap<string, boolean>,
  runId: string,
  expanded: boolean,
): ReadonlyMap<string, boolean> {
  return new Map(runExpansion).set(runId, !expanded);
}
