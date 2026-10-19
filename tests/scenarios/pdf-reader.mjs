import path from "node:path";
import { PDF_FIXTURES } from "./fixtures/index.mjs";
import { openScenarioApp } from "./lib/app.mjs";
import { check, readScenarioArgs, runScenario } from "./lib/app-session.mjs";
import { openWorkspaceFile } from "./lib/file-tree.mjs";
import { openEditorPanel } from "./lib/navigate.mjs";

const PDF_REQUEST_FRAGMENT = "/files/pdf";
const PDF_STORE_MODULE = "/src/features/pdf-reader/pdf-reader-store.ts";
const ABORTED_FULL_REQUEST_STATUS = 0;
const POSITION_PERSIST_WAIT_MS = 1_000;
const SEARCH_SETTLE_MS = 1_000;
const SEARCH_SETTLE_TIMEOUT_MS = 60_000;
const RANGE_STATUSES = new Set([200, 206, ABORTED_FULL_REQUEST_STATUS]);

const args = readScenarioArgs({
  pdf: { type: "string" },
  fixture: { type: "string", default: "sample" },
  page: { type: "string" },
  query: { type: "string" },
});

if (args.port && !args.pdf) {
  console.error(
    "Usage: node tests/scenarios/pdf-reader.mjs [--fixture sample|book] [--port <cdp port> --pdf <absolute path inside a workspace> [--url URL]] [--page N] [--query TEXT]",
  );
  process.exit(2);
}

const fixture = args.pdf ? null : PDF_FIXTURES[args.fixture];
if (!args.pdf && !fixture) {
  console.error(
    `Unknown --fixture ${args.fixture}; use ${Object.keys(PDF_FIXTURES).join(", ")}`,
  );
  process.exit(2);
}

const DEFAULT_PAGE = 10;
const query = args.query ?? fixture?.query ?? null;
const expectedMatches = args.query ? null : (fixture?.matches ?? null);
const targetPage = args.page
  ? Number.parseInt(args.page, 10)
  : (fixture?.page ?? DEFAULT_PAGE);

function requestSummary(requests) {
  return {
    requests: requests.length,
    statuses: [...new Set(requests.map((request) => request.status))],
    networkMs: Math.round(
      requests.reduce((total, request) => total + request.duration, 0),
    ),
  };
}

function checkRangeRequests(requests, step) {
  const unexpected = requests.filter(
    (request) => !RANGE_STATUSES.has(request.status),
  );
  check(
    unexpected.length === 0,
    `${step}: unexpected PDF statuses`,
    unexpected,
  );
}

async function readRequests(session) {
  return session.run(
    (fragment) =>
      window.__scenario.requests(fragment).map((entry) => ({
        status: entry.responseStatus,
        duration: entry.duration,
      })),
    PDF_REQUEST_FRAGMENT,
  );
}

async function readViewerState(session, name) {
  return session.run(
    async ({ name }) => {
      const S = window.__scenario;
      const closeLabel = await S.t("editor:actions.closeFile", {
        fileName: name,
      });
      const pageInput = S.byLabel(await S.t("editor:pdf.goToPage"));
      return {
        tabOpen: Boolean(S.byLabel(closeLabel)),
        viewerOpen: Boolean(document.querySelector(".pdfViewer")),
        page: pageInput?.value ?? null,
      };
    },
    { name },
  );
}

async function openPdf(session, filePath) {
  await session.run(
    async ({ filePath, storeModule }) => {
      const S = window.__scenario;
      const store = await S.store(storeModule);
      const module = await import(storeModule);
      store.set(module.openPdfReaderAtom, filePath);
      return true;
    },
    { filePath, storeModule: PDF_STORE_MODULE },
  );
}

async function closePdfTab(session, name) {
  await session.run(
    async ({ name }) => {
      const S = window.__scenario;
      const label = await S.t("editor:actions.closeFile", { fileName: name });
      S.byLabel(label)?.click();
      await S.sleep(500);
      return true;
    },
    { name },
  );
}

async function goToPage(session, page) {
  await session.run(
    async ({ page }) => {
      const S = window.__scenario;
      const input = S.byLabel(await S.t("editor:pdf.goToPage"));
      input.focus();
      S.setInput(input, String(page));
      S.pressEnter(input);
      input.blur();
      return true;
    },
    { page },
  );
  await session.waitUntil(
    ({ page }) => {
      const element = document.querySelector(
        `.pdfViewer .page[data-page-number="${page}"]`,
      );
      return Boolean(element?.querySelector("canvas"));
    },
    { page },
  );
}

async function readMatchTotal(session) {
  return session.run(async () => {
    const S = window.__scenario;
    const input = S.byLabel(await S.t("editor:pdf.search"));
    const counter =
      input?.parentElement?.parentElement?.innerText.match(
        /(\d+)\s*\/\s*(\d+)/,
      );
    return counter ? Number(counter[2]) : 0;
  });
}

async function waitForStableMatchCount(session) {
  const deadline = Date.now() + SEARCH_SETTLE_TIMEOUT_MS;
  let previous = -1;
  while (Date.now() < deadline) {
    const total = await readMatchTotal(session);
    if (total > 0 && total === previous) return total;
    previous = total;
    await session.run((ms) => window.__scenario.sleep(ms), SEARCH_SETTLE_MS);
  }
  throw new Error("search: match count did not settle");
}

async function resetRequests(session) {
  await session.run(() => {
    window.__scenario.resetRequests();
    return true;
  });
}

runScenario("pdf-reader", {
  open: () =>
    openScenarioApp(args, { fixtures: fixture ? [fixture.path] : [] }),
  async setup({ session, files }) {
    const pdfPath = fixture ? files[fixture.path] : path.resolve(args.pdf);
    const fileName = path.basename(pdfPath);
    const missingPath = path.join(
      path.dirname(pdfPath),
      "__scenario-missing__.pdf",
    );
    await openEditorPanel(session);
    const initial = await readViewerState(session, fileName);
    await resetRequests(session);
    await openWorkspaceFile(session, fileName);
    await session.waitUntil(
      () => document.querySelectorAll(".pdfViewer canvas").length > 0,
      null,
      20_000,
    );
    const opened = await readViewerState(session, fileName);
    return {
      pdfPath,
      fileName,
      missingPath,
      initial,
      initialPage: opened.page,
    };
  },
  steps: [
    [
      "open",
      async ({ session }) => {
        const requests = await readRequests(session);
        checkRangeRequests(requests, "open");
        const blobUrls = await session.run(
          () =>
            performance
              .getEntriesByType("resource")
              .filter((entry) => entry.name.startsWith("blob:")).length,
        );
        check(blobUrls === 0, "open: PDF loaded through a blob URL");
        return requestSummary(requests);
      },
    ],
    [
      "jump-to-page",
      async ({ session }) => {
        await resetRequests(session);
        await goToPage(session, targetPage);
        await session.waitUntil(
          ({ page }) =>
            document.querySelectorAll(
              `.pdfViewer .page[data-page-number="${page}"] .textLayer span`,
            ).length > 0,
          { page: targetPage },
        );
        const textSpans = await session.run(
          ({ page }) =>
            document.querySelectorAll(
              `.pdfViewer .page[data-page-number="${page}"] .textLayer span`,
            ).length,
          { page: targetPage },
        );
        const requests = await readRequests(session);
        checkRangeRequests(requests, "jump-to-page");
        return { page: targetPage, textSpans, ...requestSummary(requests) };
      },
    ],
    [
      "search",
      async ({ session }) => {
        await resetRequests(session);
        const searched = await session.run(
          async ({ query, page }) => {
            const S = window.__scenario;
            const fallback = [
              ...document.querySelectorAll(
                `.pdfViewer .page[data-page-number="${page}"] .textLayer span`,
              ),
            ]
              .map((span) => span.textContent.trim())
              .find((text) => /^[\p{L}\p{N}]{3,}$/u.test(text));
            const text = query ?? fallback;
            S.byLabel(await S.t("editor:pdf.toggleSearch")).click();
            await S.sleep(200);
            const input = S.byLabel(await S.t("editor:pdf.search"));
            input.focus();
            S.setInput(input, text);
            S.pressEnter(input);
            return text;
          },
          { query, page: targetPage },
        );
        check(Boolean(searched), "search: no query available");
        await session.waitUntil(
          async () => {
            const S = window.__scenario;
            const input = S.byLabel(await S.t("editor:pdf.search"));
            const bar = input?.parentElement?.parentElement;
            const counter = bar?.innerText.match(/(\d+)\s*\/\s*(\d+)/);
            return Boolean(counter && Number(counter[2]) > 0);
          },
          null,
          30_000,
        );
        await waitForStableMatchCount(session);
        const result = await session.run(async () => {
          const S = window.__scenario;
          const input = S.byLabel(await S.t("editor:pdf.search"));
          const counter =
            input.parentElement.parentElement.innerText.match(
              /(\d+)\s*\/\s*(\d+)/,
            );
          const highlights = document.querySelectorAll(
            ".textLayer .highlight",
          ).length;
          S.byLabel(await S.t("editor:pdf.searchClose")).click();
          return { matches: Number(counter[2]), highlights };
        });
        check(result.highlights > 0, "search: no highlighted matches");
        if (expectedMatches !== null) {
          check(
            result.matches === expectedMatches,
            "search: unexpected match count",
            { expected: expectedMatches, actual: result.matches },
          );
        }
        const requests = await readRequests(session);
        checkRangeRequests(requests, "search");
        return { query: searched, ...result, ...requestSummary(requests) };
      },
    ],
    [
      "thumbnails",
      async ({ session }) => {
        await session.run(async () => {
          const S = window.__scenario;
          S.byLabel(await S.t("editor:pdf.toggleThumbnails")).click();
          return true;
        });
        await session.waitUntil(
          () =>
            document.querySelectorAll(
              'img[src^="data:image"], img[src^="blob:"]',
            ).length > 0,
        );
        const thumbnails = await session.run(async () => {
          const S = window.__scenario;
          const count = document.querySelectorAll(
            'img[src^="data:image"], img[src^="blob:"]',
          ).length;
          S.byLabel(await S.t("editor:pdf.toggleThumbnails")).click();
          return count;
        });
        return { thumbnails };
      },
    ],
    [
      "reopen-restores-position",
      async ({ session, pdfPath, fileName }) => {
        const before = await readViewerState(session, fileName);
        const expectedPage = Number(before.page);
        await session.run(
          (ms) => window.__scenario.sleep(ms),
          POSITION_PERSIST_WAIT_MS,
        );
        await closePdfTab(session, fileName);
        const closed = await readViewerState(session, fileName);
        check(!closed.tabOpen, "reopen: tab did not close");
        await resetRequests(session);
        const startedAt = Date.now();
        await openPdf(session, pdfPath);
        await session.waitUntil(
          ({ page }) =>
            Boolean(
              document
                .querySelector(`.pdfViewer .page[data-page-number="${page}"]`)
                ?.querySelector("canvas"),
            ),
          { page: expectedPage },
          20_000,
        );
        const firstPaintMs = Date.now() - startedAt;
        const reopened = await readViewerState(session, fileName);
        check(
          reopened.page === String(expectedPage),
          "reopen: reading position not restored",
          reopened,
        );
        const requests = await readRequests(session);
        checkRangeRequests(requests, "reopen");
        return {
          firstPaintMs,
          page: reopened.page,
          ...requestSummary(requests),
        };
      },
    ],
    [
      "missing-file-shows-error",
      async ({ session, missingPath }) => {
        await resetRequests(session);
        await openPdf(session, missingPath);
        await session.waitUntil(
          (fragment) =>
            window.__scenario
              .requests(fragment)
              .some((entry) => entry.responseStatus === 404),
          PDF_REQUEST_FRAGMENT,
        );
        await session.run(() => window.__scenario.sleep(500));
        const viewerOpen = await session.run(() =>
          Boolean(document.querySelector(".pdfViewer canvas")),
        );
        check(!viewerOpen, "missing file: viewer rendered pages");
        await closePdfTab(session, path.basename(missingPath));
        return { status: 404 };
      },
    ],
    [
      "no-page-errors",
      async ({ session }) => {
        const errors = await session.run(() => window.__scenario.errors);
        check(errors.length === 0, "page errors were raised", errors);
        return {};
      },
    ],
  ],
  async teardown({
    session,
    isolated,
    pdfPath,
    fileName,
    missingPath,
    initial,
    initialPage,
  }) {
    if (isolated) return { restored: "isolated instance discarded" };
    await closePdfTab(session, path.basename(missingPath));
    if (!initial.tabOpen) {
      await closePdfTab(session, fileName);
      return { restored: "closed the PDF tab opened by the scenario" };
    }
    const state = await readViewerState(session, fileName);
    if (!state.viewerOpen) await openPdf(session, pdfPath);
    if (initialPage) await goToPage(session, Number(initialPage));
    return { restored: `page ${initialPage}` };
  },
});
