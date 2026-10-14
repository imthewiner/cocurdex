# Cocurdex desktop

Rules for `apps/desktop`, in addition to the repository root `AGENTS.md`.

`apps/desktop/src` is the renderer for both the Electron app and the web client, which the daemon serves (`packages/daemon/src/web-assets.ts`) behind `lib/web-host-bridge.ts`. Every UI rule below applies to both hosts.

## Public entries, heavy dependencies, and cycles

Barrels are external interfaces, never an internal bus. Files within the same domain, including siblings exported by one barrel, import each other directly with relative paths.

- Re-export by name, listing only what consumers outside the folder import, and mark type-only names with `type`. Add a name when a new consumer needs it; remove names nobody imports. Biome's `noReExportAll` rejects `export *` in `apps/desktop/src`: in dev, Vite requests every module a barrel re-exports, and wide barrels widen HMR invalidation and blur chunk boundaries. `components/ui/index.ts` is the exception that lists every primitive export so shadcn compositions do not need barrel edits.
- Keep executable code, side effects, initialization, tests, stories, and CSS out of barrels. A module-level side effect in any file a barrel re-exports runs for every importer of that barrel, including tests. Main, preload, and renderer must not share a barrel.
- Keep heavy editors, terminals, diff/tree renderers, highlighters, charts, and PDF dependencies out of broad barrels. Use feature subentries such as `@/components/markdown-body-editor`.
- For UI-gated heavy components, expose a feature-local `*-lazy.tsx` wrapper built with `lazyComponent` from `@/lib`, and export the wrapper from the barrel. Do not use `React.lazy` with `Suspense` for this: React throttles the first reveal after a committed fallback by 300 ms, which delays startup and first-open views. Split lightweight constants and pure functions from heavy modules before exporting them.
- A `lazyComponent` renders its fallback (nothing, by default) until its chunk loads, so the first open of a lazy view shows blank frames. For views users open routinely, add the wrapper to `app/layout/app-shell/idle-preload.ts`, which calls `.preload()` one chunk per idle callback after first paint. Do not `import()` barrels from `main.tsx` to preload: the startup bundle check counts entry dynamic imports as startup chunks.
- Keep heavy modules out of startup calls. Invert dependencies through events and subscribe after the heavy module loads; see `lib/theme-events.ts`. Verify entry chunk size rather than guessing.
- A feature may expose several public entries: its root `index.ts` and the `index.ts` of a cohesive subfolder (for example `@/features/sessions/agent-role`). A barrel turns every importer into a dependent of everything it re-exports, so two features that import each other's root barrels form a cycle even when their files do not. When a barrel import closes a cycle, import a narrower public entry or move the shared module to the lower feature.
- Keep feature dependencies one-way. Move cross-feature coordination into `app/layout` or a feature above both (as `features/new-session` composes `composer` and `sessions`) instead of creating bidirectional feature imports. Features never import the `@/app/layout` barrel. Run `pnpm --filter @cocurdex/desktop lint:cycles` when changing dependency structure and fix new cycles; the renderer build also fails on Rollup's `CYCLIC_CROSS_CHUNK_REEXPORT`. Only structural recursion may be considered for `ALLOWED_CYCLES` in `apps/desktop/scripts/check-cycles.mjs`, with a recorded rationale.

## UI components and consistency

Reuse installed shadcn/ui components before writing equivalent controls, menus, dialogs, forms, or feedback. Check `apps/desktop/src/components/ui` first; consider adding missing components through the shadcn CLI. Custom UI is appropriate only when no suitable component exists, composition reduces clarity, or the component is specific to the product.

| Layer | Purpose |
| --- | --- |
| `components/ui/` | shadcn primitives; avoid direct edits and never add product logic. |
| `components/app/` | App-wide wrappers for consistent APIs, defaults, and option contracts; export through `components/index.ts` and consume via `@/components` or `@/components/app`. |
| `components/chat/`, `features/*` | Domain-specific compositions, including Markdown and chat shells. |

Prefer semantic tokens, CSS mappings, wrappers, small caller styles, and composition before editing primitives. Edit `components/ui` only for upstream/accessibility fixes, missing extension points, or upstream API changes. Keep such edits minimal and reversible; explain in the PR why a wrapper is insufficient. Do not copy entire primitives or scatter caller patches to avoid editing them.

- Keep colors, interaction states, dimensions, spacing, icons, typography, radii, and shadows consistent across equivalent controls, panels, routes, and float/pinned modes. Encapsulate necessary product exceptions and explain them in the PR.
- Reuse components for repeated structure, styling, and behavior. Maintain row/column alignment, stable header heights, continuous dividers, and aligned hit areas during sidebar toggles, pinning, expansion, and state changes.
- Do not nest cards: never place a bordered or raised surface (card, `SettingsGroup`, panel) inside another. Group inner content with spacing, headings, or dividers; bordered inputs and editors inside a card are fine.
- Make titles sticky when their content scrolls: a titled scroll container should keep its title pinned (with an opaque background) so users can tell what they are scrolling through. Pin one title per scroll container; do not stack section headings under an already sticky page header.
- Keep right-click menus identical: compose `ContextMenuContent`/`ContextMenuItem`/`ContextMenuSeparator` with their default typography and padding (no caller `text-*`, `px-*`, or `py-*` overrides), and give every item a leading `size-3.5` lucide icon.
- Reuse `EmptyState` and `Spinner` for empty/loading feedback. Do not show a spinner or loading overlay while a module or panel starts up (settings, the right panel views, terminal, editor, browser): a spinner that lives for a fraction of a second reads as a flash. Leave the area blank until its content is ready, and preload the module's chunk when the wait is code loading. Reserve `Spinner` for user-initiated work inside a view that takes noticeable time, such as a request, install, or restart.
- Set dialog size through `DialogContent`'s `size` (`default`, `compact`, `wide`), without caller overrides for width, padding, or radius.
- Support RTL with logical layout, spacing, positioning, corners, icon direction, and text alignment. Use physical `left`/`right` only when the behavior is physically directional.
- Prefer `lucide-react`. Use explicit, consistent `size-3.5`, `size-4`, or `size-5` within a row or context. Conditionally render status icons; do not reserve them with `opacity-0`.

### Alignment and centering

Misalignment of a few pixels is a visible bug. Design every row, header, and toolbar against the grid of the content around it, and check it by measurement rather than by eye.

- Align to a shared column. Controls that repeat across rows (chevrons, status icons, trailing actions, counts) share one x-position; a row without that control reserves its slot with a fixed-size spacer of the same width instead of letting content shift. A header or toolbar control above a list lines up with the list's matching column, using the same horizontal padding as the rows.
- Center on the cross axis with layout, not offsets. Put icon and text in one `flex items-center` line with a fixed row height; do not nudge with `mt-px`, `translate-y-*`, or `relative top-*`. Icons in a row use one size, and mixed text sizes in a line share a baseline or the row's center consistently.
- Center a glyph inside its hit area: icon-only controls use `IconButton` sizes, so the icon sits in the middle of a square target and hover backgrounds line up across rows.
- Attach every flyout to its parent popup the same way. Submenus, row preview cards, and sidecars sit `FLYOUT_GAP` (4px) from the parent popup's outer edge, whatever the parent's padding: use `DropdownMenuSub`/`ContextMenuSub` as is, and anchor custom flyouts with `flyoutAnchor(row)` from `@/components/ui` plus `sideOffset={FLYOUT_GAP}`. Never anchor a flyout to the bare row with a hand-picked offset; `tests/scenarios/menu-flyouts.mjs` guards the gap.
- Keep alignment stable across states: expanding, collapsing, hover, selection, loading, empty, truncation, sticky headers, RTL, and both themes must not move neighboring content or break a column.
- Verify by measuring. Over CDP, compare `getBoundingClientRect()` edges and centers of the elements that should line up (for example a header switch's right edge against the rows' trailing action column) and treat any difference as a defect; a screenshot alone is not proof.

### Same scenario, same solution

A scenario the app already handles somewhere must look and behave the same everywhere it appears. Before building UI for a scenario, find where the app already solves it (confirming a destructive action, inline rename, row actions, empty or error states, status display, settings toggles, pickers) and reuse that component and interaction.

- Keep the same concept identical across views: icon, wording, action order and placement, hover and focus states, confirmation behavior, and keyboard handling (Enter submits, Escape cancels, focus returns to the trigger).
- When two places already diverge for the same scenario, unify them in the same change instead of adding a third variant. Promote the shared version to `components/app` when it is used across features.

### Choose controls by meaning

Pick a component for what the control does, not for how it looks. A `Button` performs an action; it is not a default building block for anything clickable.

| Intent | Component |
| --- | --- |
| Perform an action | `Button`; icon-only actions use `IconButton` with an `aria-label` and a `Tooltip` |
| Turn a setting on or off immediately | `Switch` |
| Include an item in a set, or multi-select | `Checkbox` |
| Pressed state of a tool or view mode | `Toggle` / `ToggleGroup` |
| Switch between sibling views in one area | `Tabs` |
| Choose one value | See [Selectors](#selectors) |
| Several actions behind one trigger | `DropdownMenu`; right-click uses `ContextMenu` with the same items |
| Show or hide a section | `Collapsible` |
| Confirm a destructive action | `AppConfirmDialog` |
| Selectable row in a sidebar or list | `SidebarListRow` with `SidebarListRowActions` |
| Status or category label | `Badge` |
| Supplementary text on hover | `Tooltip`; rich previews use `HoverCard` |
| Transient feedback after an action | toast through `sonner` |

- Never put `onClick` on a `div` or `span`, never style a `Button` to imitate a tab, switch, checkbox, or link, and never nest interactive elements (a button inside a button or a row trigger).
- Keep the role and state that come with the chosen component (`aria-checked`, `aria-pressed`, `aria-selected`, `aria-expanded`) and give every control an accessible name. Assistive technology and the role-based scenario locators in `tests/scenarios/lib/locate.mjs` both depend on them.

### Built for automation

Agents and scenario scripts drive this UI through the accessibility tree and the DOM, so key elements must be easy to find without knowing the DOM structure. Treat findability as part of a component's contract, like its props.

- Give every interactive element a role and a unique, stable accessible name within its region: visible text, `aria-label` for icon-only controls, `aria-labelledby` for regions, dialogs, lists, and panels. Names come from i18n keys, so tests resolve them with `t()` instead of hardcoding copy.
- Mark rows and items that represent product entities with their domain id (`data-session-id`, `data-issue-id`, `data-note-id`, `data-item-path`), so a locator can target one entity regardless of title, sorting, or virtualization.
- Expose meaningful state through ARIA (`aria-selected`, `aria-expanded`, `aria-checked`, `aria-busy`, `aria-invalid`) or `data-state`, so tests wait for state instead of sleeping or inspecting classes.
- Use `data-testid` only for elements with no role, name, or domain id, such as canvases and drag surfaces. Never rely on class names, DOM depth, or element order.
- A new screen or flow is not done until a scenario in `tests/scenarios` can reach its key controls through `lib/locate.mjs`; when it cannot, fix the component rather than the locator.

### Desktop and web parity

The same screen must look and behave the same in the Electron app and the web client. Hosts differ only in `HostCapabilities` (`desktopApi.capabilities`), never in layout, components, or wording for the same scenario.

- Gate host-only features on a capability (`fileManager`, `nativeDirectoryDialog`, `terminal`, `browserView`), not on platform or user-agent checks. When a capability is missing, hide the entry or use the documented daemon fallback (for example `fs.listDirectories` instead of a native directory picker); do not show a control that fails when used.
- Do not call Electron-only APIs from shared UI without a capability check, and do not add a capability for something the daemon can provide to every client.
- Account for browser constraints: shortcuts the browser reserves (such as Cmd/Ctrl+W, Cmd/Ctrl+T, Cmd/Ctrl+N) need an alternative, text and files go through web APIs with permission handling, and layouts must work at the narrower widths a browser tab allows.
- Verify user-facing changes in both hosts: the desktop app over CDP and the web client in a browser.

### Appearance tokens

Use Tailwind for layout and project semantic tokens for appearance in feature UI and app wrappers. Layout, positioning, dimensions, and spacing utilities are allowed; do not invent tokens for ordinary spacing.

- Use `Text` (`size="meta|body|display|..."`) or named project typography. Do not add arbitrary pixel text sizes or Tailwind text-size scales such as `text-xs`, `text-sm`, or `text-base`.
- Use semantic colors such as `bg-background`, `text-muted-foreground`, and chat/editor surface tokens, not arbitrary palette colors.
- Use semantic radii below, not Tailwind radius scales or arbitrary pixel radii. Add a semantic token for a necessary new design value.

| Radius token | Value | Use |
| --- | --- | --- |
| `rounded-micro` | 2px | Checkboxes, tooltip arrows, fine chrome |
| `rounded-dense` | 4px | Dense glyphs, keyboard hints, tiny icon targets |
| `rounded-control` | 6px | Controls, list rows, menu items, select triggers |
| `rounded-card` | 12px | Cards, raised surfaces, wrapper dropdowns |
| `rounded-panel` | 14px | Dialogs, large panels, message shells |
| `rounded-overlay` | 20px | Command palettes, large overlays |
| `rounded-full` | Circle | Avatars, status dots, pills |
| `rounded-none` | 0 | Joined edges, flush chrome |

`theme-tailwind.css` defines these radii. Primitives may retain shadcn classes mapped to semantic values: `sm -> dense`, `md/lg -> control`, `xl -> card`, `2xl -> panel`, `3xl/4xl -> overlay`. Directional radius classes may retain these mapped scales.

### Selectors

Do not build another value selector with `Popover + Command`, `CommandItem + AppDropdownCheck`, or feature-local Combobox composition.

| Scenario | Component |
| --- | --- |
| Searchable single selection | `AppSearchableSelect` (wraps `components/ui/combobox`) |
| Short, non-searchable single selection | `AppSelect` / `SettingsSelect` (wraps `components/ui/select`) |
| Single selection inside a mixed action menu | `AppDropdownRadioList` |
| Command palette or editor `@` / `/` completion | `Command` or existing mention/slash menus |
| Inline table/list filtering | `Input` |

Extend `AppSearchableSelect` or `AppSelect` props first. Extend primitives only when their upstream capabilities are insufficient, and expose changes through app wrappers. Direct Select/Combobox trigger and content/list composition belongs only in `components/app`.

### Searchable class names

- Write complete literal class strings so classes copied from DevTools can be found in source. Do not split tokens with concatenation or template strings.
- Use `cn` for conditions: one complete static base string, followed by conditional classes. Avoid ternaries in `className` and splitting the static base across arguments.
- Extract repeated structure, styles, and behavior into components, not class-string constants. For DOM string generation or third-party overrides, prefer functions or components; explain any necessary exception outside code comments.
- Split components when class lists make lines unwieldy; do not sacrifice searchability by splitting strings.

## React hooks and effects

- Call hooks only at the top level of function components or custom hooks, before early returns; never inside conditions, loops, callbacks, event handlers, or classes. Put conditional behavior inside the hook.
- Keep `react` and `react-dom` versions aligned, and use one React instance. Biome's React domain enables `useHookAtTopLevel` automatically.
- Effects are only for synchronizing external systems such as DOM, network, timers, subscriptions, browser APIs, or non-React components. Before adding `useEffect`, explain the external system and why render calculations, event handlers, stable `key` resets, lifted state, or memoization cannot replace it.
- Call `useEffect`, `useLayoutEffect`, and `useInsertionEffect` only inside custom hooks (functions named `use*`), never directly in a component body, and import them from `react` under their own names. Name the hook after the external system it syncs (`usePanThumb`, `useChatBottomStick`) and keep the state that effect maintains inside the hook. A component-local hook can stay in the component file without being exported; extract it to a sibling `use-*.ts` when the component file is large. The `biome-plugins/no-effect-outside-hooks.grit` plugin enforces this in `apps/desktop/src` (excluding `components/ui`).
- Default to `useEffect`. Use `useLayoutEffect` only when the effect must read layout or write the DOM before paint, such as keeping a scroll position anchored; it blocks paint, so never use it to hide a flicker that render-time derivation would remove. Lint cannot judge this choice; review does.
- Derive values during render; use `useMemo` only for measured expensive computations. Avoid mirrored state, effect chains, and effect-based parent notifications. Handle user actions and related state updates in their originating event; use controlled components or lifted state when appropriate.

### Fast Refresh exports

A `.tsx` module that exports a component is a Vite Fast Refresh boundary. `@vitejs/plugin-react` accepts the update only when every runtime export is a component, or a string, number, or boolean that stays `===` to the previous value. A plain function, hook, atom, array, or object is a new value when the module re-executes, so the plugin invalidates importers. `export *` barrels repeat that walk across the shell until `main.tsx` fully reloads, which is the long `hmr invalidate` / `hmr update` burst in the dev server log.

- Keep helpers, hooks, and atoms in a sibling `.ts` module that exports no components. Callers import them from that module.
- Do not re-export those values from the component module. A barrel may export them from the `.ts` module.
- `export type` is erased and may stay beside components.
- Do not register ignored refresh exports to keep a mixed module. Importers would keep the previous function.
- Leave `components/ui` upstream exports such as `buttonVariants` in place. Do not split primitives only to satisfy this rule.

References: [Rules of Hooks](https://react.dev/warnings/invalid-hook-call-warning), [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect), and Tailwind CSS's *Styling with utility classes - Managing duplication*.
