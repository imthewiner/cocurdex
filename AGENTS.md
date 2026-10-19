# Cocurdex

## Working principles

- Use English for code, documentation, and commit messages.
- macOS, Windows, and Linux are equally supported release platforms. Design, implement, and verify every change for all three; see [Cross-platform](#cross-platform).
- Do not tailor answers to please the user. Reason from first principles and the underlying problem, and propose the most sound solution even when it differs from the user's suggestion; say plainly where and why you disagree.
- Fix root causes in the design, data model, API, or control flow, and remove obsolete internal paths. Released contracts — persisted data, settings, and the `cocurdex` CLI commands, flags, and output that scripts and product skills depend on — change only additively or with a migration. Add other compatibility layers only when explicitly requested.
- Every client — the Electron desktop app, the web client, and the planned mobile app — must keep functional correctness, user experience, performance, and memory use at the same bar. Do not trade one for another: a change that works but buffers whole files, duplicates large payloads across processes, blocks a shared connection, or regresses first paint is not done. Move large or binary data by streaming with on-demand reads (for example HTTP `Range`), not as base64 or whole-file RPC payloads, and measure size, latency, and peak memory on realistic inputs before and after.
- Work autonomously. Do everything you can run or verify yourself — builds, dev app restarts, daemon rebuilds, CDP attaches, CLI calls, PR checks — instead of asking the user to do it or waiting for them. Ask only for decisions that belong to the user or for actions you cannot perform, such as credentials, interactive logins, or physical devices.
- Write only code and tests. Do not write documentation in any form: no READMEs, design docs, ADRs, glossaries, guides, code comments (`//`, block comments, JSX comments), or JSDoc. Express intent through naming, types, structure, and tests. Tool-required directives and agent instruction files (`AGENTS.md`, skills) are the only exceptions.
- Prefer the latest stable dependencies. Use prerelease or deprecated versions only when explicitly requested or required for compatibility.
- Verify current information, versions, API behavior, platform limits, troubleshooting, configuration, and third-party tooling against official documentation, repositories, release notes, or standards before drawing conclusions or changing code. Prefer current official sources when sources conflict and explain the choice. If verification is unavailable, state the uncertainty and limit conclusions to local evidence. Verify advice with cost, risk, or long-term maintenance implications.

## Cross-platform

Assume nothing POSIX-only. When a change touches processes, shells, signals, paths, file permissions, line endings, or packaging, handle each platform explicitly.

- Spawn third-party executables through `spawnCommand` from `@cocurdex/agent-adapters` (cross-spawn). A plain `spawn`/`execFile` cannot launch Windows `.cmd`/`.bat` shims such as `npx` or npm-installed CLIs, and does not apply `PATHEXT`. Pass arguments as an array; never build a shell string.
- Stop process trees, not single processes. Windows has no signals: `child.kill()` is an immediate `TerminateProcess` that orphans grandchildren, so use `taskkill /T /F` (see `killProcessTree`). On POSIX, escalate from a graceful stop to SIGTERM to a tree kill.
- Build paths with `node:path`, compare them with platform-aware helpers (Windows and default macOS volumes are case-insensitive), and never hardcode `/`, `~`, `HOME`, or `/tmp`; use `os.homedir()`, `os.tmpdir()`, and the app's user-data path.
- Do not depend on tools a platform may lack (`which`, `ps`, `unzip`, `bash`, GNU flags) without a fallback for the others. Write files with explicit encodings and tolerate `\r\n` when parsing tool output.
- Verify on the platforms you can run and state which ones were not verified. Prefer pure functions that take `platform` as a parameter so Windows and Linux branches are covered by unit tests on any host.

## Git and branches

Never change code or commit on `main`. Create a branch before the first edit or commit. If work has already landed on `main`, move it to a branch with `git branch <name>`, `git checkout <name>`, then `git branch -f main <original-commit>`, leaving the working tree untouched. Never push to `main` or rewrite its history.

When the checkout is already on a branch other than `main`, reuse that branch instead of creating or switching to a new one. Switching branches interrupts other tasks sharing the checkout, and a shared worktree cannot check out the same branch twice. Only create or switch branches when explicitly asked.

Do not open a new branch unless it is necessary. Unrelated follow-up fixes found while working go on the current branch and its PR; do not split them into separate branches or propose doing so. A new branch is necessary only when starting from `main`, or when the current branch's PR has already merged.

Land changes through a branch and a pull request: push, open the PR, watch its checks and review threads, then merge with `gh pr merge --merge`. Clear every review thread first — fix it, or reply with a reason and then resolve it. Docs, skills, and tooling changes take this path with no version bump and no tag; only an explicit release request bumps `apps/desktop/package.json` and pushes a `v<version>` tag. See `.agents/skills/desktop-release`.

CI fingerprints the tree without `AGENTS.md`, `CLAUDE.md`, root `*.md`, `docs/`, Markdown under `.agents/` and `.claude/`, and the desktop `version` field. When every job passes, it records that fingerprint, and a later run with the same fingerprint (in the same PR, or on `main`) skips the checks. A docs-only or version-only push therefore costs one short job; anything else the tests could read must stay out of that exclusion list.

## Architecture: daemon, host, and clients

Reusable product capabilities belong in `packages/daemon`, exposed through `@cocurdex/rpc`. Ask: would a browser client need this capability through the daemon? If yes, use daemon RPC; desktop-only host APIs use Electron IPC.

| Layer | Responsibilities |
| --- | --- |
| Daemon | Sessions, worktrees, notes, issues, workflows, providers, agent roles, product settings, permissions, plan approvals, headless workspace Git/filesystem operations, and all persistence. SQLite is owned exclusively by the daemon. |
| Shared contracts | Types and invariants in `@cocurdex/shared`; named product RPC methods in `@cocurdex/rpc`. Do not add product behavior to `storage.call`. |
| Electron host (`apps/desktop/electron`) | Windows, menus, native dialogs, system appearance/fonts, protocols, BrowserView, PTY, file watching that requires `BrowserWindow`, updates, and thin daemon forwarding. Forwarding handlers only validate and call `requestDaemon(...)`. |
| Clients (renderer, CLI, future web/mobile) | UI and navigation orchestration; read and write product state through daemon contracts. No duplicate business protocols or client-owned product policies. |

Capabilities needed by the CLI must not exist only in IPC. When modifying IPC that contains product logic, move that logic into the daemon instead of extending it there.

Right-panel features (files, Git, notes, issues, decks, browser, PDF, terminal) are agent-native, not human tools with agent access bolted on. Whatever a person can create, change, or read in such a view, an agent can do through the `cocurdex` CLI and a product skill, backed by the same daemon capability; design that capability and its CLI together with the UI, and do not ship UI-only actions. Agent output lands as ordinary product data that the person sees, edits, and undoes in the same view, and an agent can read back the structured state it needs to check its own work. When a host limitation keeps a feature from meeting this bar, say so in the PR.

## Data compatibility

Persisted user data outlives any single release. Never delete, recreate, or rewrite a database because the application version changed.

- Migrate `cocurdex.sqlite` forward in `packages/db/src/migrations.ts`. Every schema change bumps `CURRENT_SCHEMA_VERSION` and adds a step to `MIGRATION_STEPS` that preserves existing rows.
- Keep migrations additive or value-preserving. Add and backfill columns instead of renaming or dropping columns that hold user data; a rename copies the old values into the new column before the old one is removed.
- Treat persisted JSON columns (`provider_snapshot_json`, `attachments_json`, `origin_json`, workflow artifacts) as versioned data: read old shapes, and change them additively or migrate the stored values in the same release.
- Keep `getDefaultUserDataPath()` and `DATABASE_FILENAME` stable. A new channel, build flavor, or rename must not move where an installed app reads its existing data.
- Recreate only a file without the `COCU` application marker, and move it aside as a `.bak-<timestamp>` file first. Refuse a database written by a newer schema version; never downgrade or delete it.
- Opening a database that needs a migration writes a `cocurdex.sqlite.pre-migration-<timestamp>` snapshot. The newest snapshot is always kept; older ones are deleted once they are 14 days old, and at most three are kept.
- Cover each migration with a test that seeds the previous schema, migrates, and asserts that sessions, workspaces, messages, notes, and issues survive.

## Verification and tests

After edits, run applicable checks in this order and fix reported issues:

1. For new `t("...")` calls, run `pnpm --filter @cocurdex/desktop i18n:extract`, complete en-US and zh-CN translations, then run `pnpm --filter @cocurdex/desktop i18n:types` and `pnpm exec biome check --write apps/desktop/src/i18n` (biome normalizes the generated `.d.ts`; CI fails on stale output). `src/locales/*.json` and `src/i18n/*.generated.d.ts` are generated artifacts: resolve merge conflicts by rerunning this chain, never by hand-editing them.
2. Run the affected packages' TypeScript checks, scoped to changed TypeScript source files.
3. Run `pnpm exec biome check --write <changed-files>` for supported files. For Markdown-only changes, run `git diff --check`; no TypeScript check is needed.

Use TDD for critical pure functions and similarly stable logic. UI, feature flows, and rapidly changing behavior do not require TDD; add valuable regression coverage when behavior stabilizes.

- Test important business semantics, algorithms, state transitions, protocol/persistence boundaries, and high-risk regressions, not coverage numbers.
- Avoid testing implementation details such as classes, DOM nesting, indexes, internal call order, trivial string assembly, or pass-through getters unless they express an explicit visual, accessibility, or protocol contract.
- Import tested modules directly and mock real boundaries, not broad barrels or large objects. Avoid unrelated module initialization; do not export internals solely for tests.
- Do not write tests that grep source text for the presence or absence of strings, imports, or constructs (logging lines, `useEffect`, file layout), or that assert on incidental implementation text. These tests break on harmless refactors while protecting no observable behavior; enforce the intent with a lint rule, review, or a behavior-level test instead.
- Rewrite or remove brittle tests that break during routine refactoring or UI/copy changes without protecting important behavior. Do not distort production code to preserve them.

Tests are a maintained asset and live in the root `tests/` folder, never next to source: `tests/unit/<package>/` for unit and integration tests, `tests/e2e/` for process-level e2e, and `tests/scenarios/` for app-level e2e. Each `tests/unit/<package>` is its own workspace package, `@cocurdex/unit-<package>`, with its own `vitest.config.ts` (`pnpm --filter @cocurdex/unit-daemon test`). Tests import the code under test through package public entries, test-only subentries such as `@cocurdex/daemon/testing`, or the `@cocurdex/<package>/internal/<path>` subentry for modules a public entry does not export; desktop tests use `@/` for `apps/desktop/src` and `@desktop/` for the rest of `apps/desktop`. Never import through `packages/*/src` or relative paths into source folders, and resolve source files at runtime with `createRequire(import.meta.url).resolve(...)` instead of `import.meta.url`-relative paths. Production code must not import `internal` subentries; biome enforces this. Keep fixtures fixed and committed under the owning test folder (for example `tests/scenarios/fixtures/`), generated deterministically where possible, so every run sees the same input. Tests leave nothing behind: create temporary directories with `createTempDirs()` from `@cocurdex/shared/testing` and call its `cleanup()` in `afterAll`, and never write directly into `os.tmpdir()`.

`tests/e2e` (`pnpm --filter @cocurdex/e2e test`) runs deterministic process-level e2e: it spawns the real daemon binary and CLI against an isolated `COCURDEX_USER_DATA_PATH`, then drives production clients over the real socket. `desktop-smoke.test.ts` launches the built Electron app and verifies the window, the spawned daemon, and a clean renderer; it runs only through `pnpm --filter @cocurdex/e2e test:desktop` after `pnpm --filter @cocurdex/desktop exec electron-vite build`, fails when the build output is missing, and with `COCURDEX_DESKTOP_PACKAGED=1` launches the packaged app from `apps/desktop/release` instead. Keep `tests/e2e` free of LLM providers, network, keychain, and UI assertions.

Agent behavior in tests comes from `tests/e2e/helpers/llm-stub.ts`, a local OpenAI-compatible server that drives the real Pi adapter: a `script` plan replays text and tool calls (`read`, `write`, `edit`) turn by turn, so runs, tool outcomes, and file changes go through production code. Do not add test-only adapters or test hooks to the daemon.

Shared product data for tests comes from the fixture database: `tests/e2e/fixture-db/recipe.ts` declares a synthetic workspace (`tests/e2e/fixtures/acme-shop`), sessions with scripted turns, notes, and issues, and `installFixtureDb` builds it through a real daemon and installs it into a userData path. Scenarios opt in with `openScenarioApp(args, { fixtureDb: true })` or `--fixture-db`. Extend the recipe instead of hand-building data in each test. Fixture content must be invented: never copy data from a real `cocurdex.sqlite`, and keep names, emails (`example.invalid` only), paths, and credentials synthetic; `fixture-db.test.ts` scans the built database for home paths, machine identity, emails, and token shapes.

`tests/scenarios` holds app-level e2e scripts that drive the real desktop UI over CDP, for example `node tests/scenarios/pdf-reader.mjs`. By default a scenario launches its own isolated instance (fresh short userData path, free CDP port, its own `electron-vite dev` renderer server), seeds a workspace with its fixtures, runs, prints a JSON report, and stops the instance tree; `--port <cdp port>` attaches to a running app instead, and `--keep` leaves the isolated instance up for debugging (`tests/scenarios/stop-instance.mjs` stops it). `pnpm test:ui` runs every scenario against one shared isolated instance with the fixture database, re-seeding workspaces and reloading the renderer between scenarios; pass scenario names to run a subset and `--isolated` to give each scenario its own instance. Build new scenarios on `tests/scenarios/lib`. Locate elements by role and accessible name with `lib/locate.mjs` (CDP accessibility tree), fall back to domain `data-*` attributes such as `data-item-path` for rows without a semantic name, and do not select by CSS classes or DOM structure; when a control has no usable role or name, fix its accessibility in the component. Wait for the expected state instead of sleeping after an action. When you verify a flow by hand and its steps and assertions are deterministic, turn it into a scenario script in the same change so the next run executes it instead of re-deriving it.

Startup performance has a baseline. CI fails when the renderer's startup chunks exceed `apps/desktop/startup-budget.json` (`pnpm --filter @cocurdex/desktop check:startup-bundle` after a build) or when desktop code imports `lazy`/`Suspense` from `react`. Raise the budget with `check:startup-bundle --update` only for intended growth, and justify it in the PR. When a change touches startup (entry imports, app shell, bootstrap, main-process `whenReady`), compare `pnpm --filter @cocurdex/desktop perf:startup` on builds before and after; add `--onboarding` for the first-run screen. Reference on Apple Silicon (2026-09-30): returning user FCP about 70–90 ms and LCP about 100 ms.

## Development and UI verification

Start or restart the desktop dev app yourself when verification needs it; do not wait for the user. When a renderer edit does not show up after HMR (for example, new Tailwind classes missing from the served CSS), restart the instance at once instead of waiting or debugging HMR. A change to main, preload, or the bundled daemon needs a restart, since HMR only reloads the renderer: run `pnpm --filter @cocurdex/desktop dev:inspect`, which rebuilds `prepare:cli` and spawns the rebuilt daemon. To restart a running dev app, stop the exact `dev:inspect`/`dev` process tree you found (by PID, never by process name), relaunch it detached with output redirected to a log file that outlives your shell, wait for the CDP port, and tell the user the log path. Restart the user's dev app whenever a change needs it, even while agent runs or other work in it are in progress; the user accepts the interruption, so do not hold back a restart or route around it with an isolated instance.

You may attach to a running desktop app over Chrome DevTools Protocol yourself to debug, without asking first: read the renderer console, evaluate JavaScript, inspect the DOM, measure layout, and take screenshots. Keep the attach disposable: detach when the investigation is done, and restore what you changed (open views, theme, test data).

After finishing a feature or bug fix that changes user-facing behavior, run an end-to-end check yourself and report it; do not hand verification to the user. Drive the real app over CDP — click, type, navigate, open the affected views — or a browser for the web client, covering the main flow, edge cases, and both themes when appearance changes. Look for functional bugs, console errors, failed requests, and performance or memory regressions. Prefer an existing scenario in `tests/scenarios`, extend it, or add one. Report what you exercised, the measurements, the problems found and fixed, and what you could not cover. Skip this only for changes with no runtime surface, such as docs, tooling, or pure refactors already covered by tests.

Several worktrees and agents run e2e at the same time, so every automated check must be safe to run in parallel. Never share the user's dev app, its userData profile (`Cocurdex-dev`), CDP port 9222, or a renderer server from another checkout: the single-instance lock and the daemon socket are scoped to the userData profile, so a shared profile makes the second app exit or connect to another worktree's daemon, and a borrowed renderer URL runs another checkout's code. Each instance gets its own short `COCURDEX_USER_DATA_PATH` under `os.tmpdir()` (the macOS socket path limit is 103 bytes), its own free `COCURDEX_REMOTE_DEBUGGING_PORT`, and its own `electron-vite dev`, which picks a free Vite port; the scenario launcher does all of this. Attach to the user's app only for checks that need its real data, keep them read-only or restore what you changed, and fall back to running a check alone only when it truly cannot be isolated. Run at most 5 concurrent instances, and stop only the process trees you started, by PID. Stop an isolated instance as soon as you are done with it, including one left up with `--keep` or replaced by a restart; before ending a turn, stop every instance you started that is no longer in use.

Prefer measuring over guessing. When a symptom involves rendering, layout, timing, or third-party behavior and a CDP session can answer it, attach and measure before proposing a cause or a fix; state the measurement that settled it. Do not stack hypotheses, batch speculative fixes, or ask the user to re-verify round after round when the running app can be inspected directly.

Final visual and UX acceptance stays with the user. After your end-to-end check, briefly state what changed and which screen to inspect. Diagnose runtime errors, console exceptions, and reproducible functional failures yourself through code, logs, and a CDP session.

## Code structure and imports

- Keep feature-specific components, hooks, utilities, types, and fixtures together. Move shared code outward only as its reuse scope grows; cross-app reuse belongs in `packages`, not imports between apps.
- Give source folders an `index.ts` or `index.tsx` public entry that exports only what consumers need.
- Across features in `apps/desktop/src`, use `@/*`; across packages, use `@cocurdex/*` public entries. Within a feature, use short relative imports.
- Do not bypass boundaries with `packages/*/src/*`, `apps/*/src/*`, deep relative paths, or internal file imports. Add missing public exports instead.
- Avoid long lines and nested ternaries. Use named values, helpers, `if`, or lookup tables for complex branches.
- Before editing a code file over 400 lines, prefer extracting cohesive components, hooks, utilities, or fixtures unless that reduces clarity or expands scope. Markdown files are exempt.
- Desktop-specific rules (barrels, lazy loading, UI components, appearance tokens, React hooks, Fast Refresh) live in `apps/desktop/AGENTS.md`.

## Product knowledge and skills

- PRDs, specs, notes, and issues live only in the daemon-owned `cocurdex.sqlite`. Never write them into the workspace or open the database directly; use the `cocurdex` CLI.
- Use namespaced skills: `/cocurdex-note` for notes, PRDs, specs, and links -> `/cocurdex-issue` for issues and their status while you implement them. Parallel teammate agents: `/cocurdex-team`; scripted fan-out to background subagents: `/cocurdex-script-run`; app settings: `/cocurdex-settings`. Todo and ticket mean issue.
- Manage issues (list, show, create, move, delete, views) through `@cocurdex/cli` using `cocurdex issue ...`. Never invent IDs or manually rewrite status.
- Distribute skills from `packages/product-skills` through Settings > Skills or `cocurdex skills install --scope project|global`; do not auto-install. This repository symlinks `.agents/skills/cocurdex-*` and `.claude/skills/cocurdex-*` to that source; never commit installed copies.
- Product skills are part of the CLI contract. When a change adds, renames, or removes a `cocurdex` CLI command, flag, output field, or the daemon capability behind it, update the affected `packages/product-skills/skills/cocurdex-*` in the same PR. When adding a daemon capability agents should use, decide whether it needs a CLI command and skill coverage.
