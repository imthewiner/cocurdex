import type {
  IssueFieldOption,
  IssueRecord,
  IssueStatusCategory,
} from "@cocurdex/shared";

export interface IssueSection {
  status: IssueFieldOption;
  issues: IssueRecord[];
}

const CATEGORY_ORDER: Record<IssueStatusCategory, number> = {
  started: 0,
  unstarted: 1,
  backlog: 2,
  completed: 3,
  canceled: 4,
};
const UNCATEGORIZED_ORDER = 5;

function categoryOrder(category: IssueStatusCategory | null) {
  return category ? CATEGORY_ORDER[category] : UNCATEGORIZED_ORDER;
}

function matches(issue: IssueRecord, needle: string) {
  if (!needle) return true;
  return (
    issue.title.toLocaleLowerCase().includes(needle) ||
    issue.identifier.toLocaleLowerCase().includes(needle)
  );
}

export function issueSections(
  issues: readonly IssueRecord[],
  statusOptions: readonly IssueFieldOption[],
  workspaceId: string | null,
  query: string,
): IssueSection[] {
  const needle = query.trim().toLocaleLowerCase();
  const shown = issues.filter(
    (issue) =>
      (workspaceId === null || issue.workspaceId === workspaceId) &&
      matches(issue, needle),
  );
  return statusOptions
    .map((status, order) => ({ status, order }))
    .sort(
      (left, right) =>
        categoryOrder(left.status.category) -
          categoryOrder(right.status.category) || left.order - right.order,
    )
    .map(({ status }) => ({
      status,
      issues: shown
        .filter((issue) => issue.status === status.id)
        .sort((left, right) => left.sortOrder - right.sortOrder),
    }))
    .filter((section) => section.issues.length > 0);
}
