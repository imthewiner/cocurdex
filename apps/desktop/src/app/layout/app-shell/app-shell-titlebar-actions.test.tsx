import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import { AppShellTitlebarActions } from "./app-shell-titlebar-actions";
import { RightPanelWindowActions } from "./right-panel-window-actions";

function renderActions(
  overrides: Partial<ComponentProps<typeof AppShellTitlebarActions>> = {},
) {
  return render(
    <AppShellTitlebarActions
      isChatDetached={false}
      isRightPanelOpen
      onOpenSettings={() => {}}
      onToggleRightPanel={() => {}}
      {...overrides}
    />,
  );
}

describe("AppShellTitlebarActions", () => {
  it("toggles the editor panel while chat is in this window", () => {
    renderActions();

    expect(
      screen.getByRole("button", { name: "Close editor panel" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Settings" })).toBeVisible();
  });

  it("offers to open a closed editor panel", () => {
    renderActions({ isRightPanelOpen: false });

    expect(
      screen.getByRole("button", { name: "Open editor panel" }),
    ).toBeVisible();
  });

  it("keeps only settings while chat lives in its own window", () => {
    renderActions({ isChatDetached: true });

    expect(
      screen.queryByRole("button", { name: "Open editor panel" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Close editor panel" }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Settings" })).toBeVisible();
  });
});

describe("RightPanelWindowActions", () => {
  it("offers fullscreen and docking for a side-by-side editor", () => {
    render(
      <RightPanelWindowActions
        isRightPanelMaximized={false}
        onToggleRightPanelMaximize={() => {}}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Enter full screen" }),
    ).toBeVisible();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("offers only exiting fullscreen for a maximized editor", () => {
    render(
      <RightPanelWindowActions
        isRightPanelMaximized
        onToggleRightPanelMaximize={() => {}}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Exit full screen" }),
    ).toBeVisible();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
