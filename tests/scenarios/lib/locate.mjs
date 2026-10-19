const POLL_INTERVAL_MS = 100;
const DEFAULT_TIMEOUT_MS = 15_000;

function matchesName(actual, expected, exact) {
  if (expected === undefined) return true;
  if (expected instanceof RegExp) return expected.test(actual);
  return exact ? actual === expected : actual.includes(expected);
}

function matchesQuery(node, { role, name, exact = true }) {
  if (node.ignored || node.role?.value !== role) return false;
  return matchesName(node.name?.value ?? "", name, exact);
}

function describeQuery({ role, name, within }) {
  const target = name === undefined ? role : `${role} "${name}"`;
  return within ? `${target} in ${describeQuery(within)}` : target;
}

export async function queryAllByRole(session, query) {
  const { nodes } = await session.send("Accessibility.getFullAXTree", {});
  const byId = new Map(nodes.map((node) => [node.nodeId, node]));
  const isInside = (node) => {
    if (!query.within) return true;
    for (
      let parent = byId.get(node.parentId);
      parent;
      parent = byId.get(parent.parentId)
    ) {
      if (matchesQuery(parent, query.within)) return true;
    }
    return false;
  };
  return nodes
    .filter((node) => matchesQuery(node, query) && isInside(node))
    .map((node) => ({
      backendNodeId: node.backendDOMNodeId,
      name: node.name?.value ?? "",
    }));
}

export async function waitForRole(
  session,
  query,
  timeout = DEFAULT_TIMEOUT_MS,
) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const matches = await queryAllByRole(session, query);
    if (matches.length > 0) return matches;
    if (Date.now() >= deadline) {
      throw new Error(`No ${describeQuery(query)} within ${timeout}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

export async function waitForNoRole(
  session,
  query,
  timeout = DEFAULT_TIMEOUT_MS,
) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const matches = await queryAllByRole(session, query);
    if (matches.length === 0) return;
    if (Date.now() >= deadline) {
      throw new Error(
        `${describeQuery(query)} still present after ${timeout}ms`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

export async function clickPoint(session, point, button = "left") {
  for (const type of ["mousePressed", "mouseReleased"]) {
    await session.send("Input.dispatchMouseEvent", {
      type,
      button,
      clickCount: 1,
      ...point,
    });
  }
}

export async function centerOf(session, backendNodeId) {
  await session.send("DOM.getDocument", { depth: 0 });
  await session.send("DOM.scrollIntoViewIfNeeded", { backendNodeId });
  const { model } = await session.send("DOM.getBoxModel", { backendNodeId });
  const [left, top, , , right, bottom] = model.border;
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

export async function clickByRole(
  session,
  query,
  timeout = DEFAULT_TIMEOUT_MS,
  button = "left",
) {
  const matches = await waitForRole(session, query, timeout);
  if (matches.length > 1) {
    const names = matches.map((match) => match.name);
    throw new Error(
      `${describeQuery(query)} is ambiguous: ${JSON.stringify(names)}`,
    );
  }
  await clickPoint(
    session,
    await centerOf(session, matches[0].backendNodeId),
    button,
  );
  return matches[0];
}
