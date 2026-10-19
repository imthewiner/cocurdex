---
name: cocurdex-deck
description: Create, revise, check, and export Cocurdex slide decks (presentations, PPT) through the CLI.
---

# Cocurdex Deck

Decks are app-owned SQLite records with stable ids, shown in the Decks panel.
Use `cocurdex deck`; do not write `.pptx` files by hand or open the SQLite
file. Export a `.pptx` only when the user asks for a file.

```bash
cocurdex deck list --json
cocurdex deck show <id> --json
cocurdex deck create [--title <title>] --markdown-file <path|-> [--workspace <id>] --json
cocurdex deck update <id> [--title <title>] [--markdown-file <path|-> | --content-file <path|->] [--expected-revision <n>] --json
cocurdex deck check <id> --json
cocurdex deck export <id> --output <path.pptx> --json
cocurdex deck delete <id> --json
```

## Write decks as Markdown

Markdown is the fastest way to write a whole deck. The daemon compiles it into
slides with layouts; the result is ordinary deck data the person can edit.

- `---` on its own line separates slides.
- A slide with a `#` heading and only plain paragraphs is a title slide: the
  first one becomes the cover, the last one the closing slide, and any other a
  section divider. The paragraphs become its subtitle.
- A `##` heading is a content slide title. Lists (bullet, numbered, task, up to
  five levels), paragraphs, quotes, and code blocks fill the body.
- Exactly two `###` sections, with the first one right after the title, make a
  two-column slide.
- A table makes a table slide; text before or after it becomes a caption above
  it. Keep one table per slide.
- A `##` heading with no body is a title-only slide.
- A paragraph starting with `Notes:` (or `备注：`) starts the speaker notes;
  everything after it on that slide is notes, not slide content.
- Inline bold, italic, strikethrough, code, and links are kept. Images are not
  supported yet and are dropped with a warning.

```markdown
# Q3 Review
Platform team · October 2026

---

## Highlights
- Shipped sync to all users
  - p95 latency down 38%
- Two incidents, both resolved within SLA

Notes: Open with the latency win.

---

## Plan
### Now
- Hardening
### Next
- Mobile client

---

# Thank you
Questions?
```

## Check your work

`create` and `update` return `{ deck, warnings, issues }`. `warnings` lists
Markdown the compiler dropped; `issues` lists problems in the result:

- `overflow`: text or a table does not fit even at the smallest font size.
  Shorten it or split the slide.
- `empty-slide`: a slide has no content.
- `unknown-slot`: content sits in a slot the slide's layout does not show.

Fix every issue before you report the deck as done. `deck show` includes the
current `issues`, and `deck check` returns them alone.

## Precise edits with JSON content

`deck show --json` returns `content`, the structured deck. To change part of a
deck without regenerating it, edit that JSON and send it back with
`--content-file`, keeping slide and element ids stable:

- `slides[]`: `{ id, layout, slots, slotFrames?, elements, notes }`.
- `layout`: `cover`, `section`, `title-content`, `two-content`,
  `title-only`, `closing`, or `blank`.
- `slots`: `title`, `subtitle`, `body`, `left`, `right`, each
  `{ kind: "text", paragraphs }` or `{ kind: "table", table }`. Only the slots
  the layout defines are shown.
- A paragraph is `{ runs, list?: "bullet" | "number", level?, align? }`; a
  run is `{ text, bold?, italic?, underline?, strike?, code?, link?, color? }`.
- Colors are theme tokens: `text`, `muted`, `accent`, `page`, `surface`,
  `onAccent`.
- Coordinates (`slotFrames`, element `frame`) use a 1280×720 canvas.
- Fonts are sized automatically to fit; there is no font size field.

A Markdown update replaces every slide and its ids. Prefer JSON content for
targeted edits to a deck the person has already worked on.

## Concurrent edits

People may edit a deck in the app while you work on it. When you send content
based on an earlier `deck show`, pass its `revision` as
`--expected-revision <n>`. The update fails with "Deck was modified" when the
deck changed since then: run `deck show` again, reapply your change, and retry.
