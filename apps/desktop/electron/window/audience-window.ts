import {
  app,
  BrowserWindow,
  type IpcMain,
  type IpcMainInvokeEvent,
  screen,
} from "electron";
import { registerHandler, schemas } from "../ipc";
import { denyWindowNavigation, resolveMainWindowDevTools } from "../security";
import { audienceWindowPlacement } from "./audience-placement";
import { rendererPageUrl } from "./renderer-page";

const AUDIENCE_BACKGROUND = "#000000";

let audienceWindow: BrowserWindow | null = null;

function presenterDisplayId(event: IpcMainInvokeEvent): number {
  const presenter = BrowserWindow.fromWebContents(event.sender);
  const display = presenter
    ? screen.getDisplayMatching(presenter.getBounds())
    : screen.getPrimaryDisplay();
  return display.id;
}

async function openAudienceWindow(
  preloadPath: string,
  event: IpcMainInvokeEvent,
  channel: string,
) {
  audienceWindow?.destroy();
  const placement = audienceWindowPlacement(
    screen.getAllDisplays(),
    presenterDisplayId(event),
  );
  const window = new BrowserWindow({
    ...placement.bounds,
    show: false,
    title: "Cocurdex Presentation",
    backgroundColor: AUDIENCE_BACKGROUND,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      backgroundThrottling: false,
      devTools: resolveMainWindowDevTools({ packaged: app.isPackaged }),
    },
  });
  audienceWindow = window;
  window.on("closed", () => {
    if (audienceWindow === window) audienceWindow = null;
  });
  denyWindowNavigation(window.webContents);
  window.once("ready-to-show", () => {
    if (placement.fullscreen) window.setFullScreen(true);
    window.show();
  });
  await window.loadURL(rendererPageUrl({ window: "deck-audience", channel }));
  return { opened: true, externalDisplay: placement.fullscreen };
}

export function registerAudienceWindowHandlers(
  ipc: IpcMain,
  options: { preloadPath: string },
) {
  registerHandler(
    ipc,
    "presentation:openAudienceWindow",
    schemas.audienceWindow,
    (event, request) =>
      openAudienceWindow(options.preloadPath, event, request.channel),
  );
}
