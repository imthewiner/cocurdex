export async function openWorkspaceFile(session, relativePath) {
  const findRowCenter = (relativePath) => {
    const roots = [document];
    for (const root of roots) {
      const row = [...root.querySelectorAll("[data-item-path]")].find(
        (element) => element.dataset.itemPath === relativePath,
      );
      if (row) {
        row.scrollIntoView({ block: "center" });
        const bounds = row.getBoundingClientRect();
        if (bounds.width > 0 && bounds.height > 0) {
          return {
            x: bounds.x + bounds.width / 2,
            y: bounds.y + bounds.height / 2,
          };
        }
      }
      for (const element of root.querySelectorAll("*")) {
        if (element.shadowRoot) roots.push(element.shadowRoot);
      }
    }
    return false;
  };
  await session.waitUntil(findRowCenter, relativePath, 30_000);
  const rowCenter = await session.run(findRowCenter, relativePath);
  await session.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    button: "left",
    clickCount: 1,
    ...rowCenter,
  });
  await session.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    button: "left",
    clickCount: 1,
    ...rowCenter,
  });
}
