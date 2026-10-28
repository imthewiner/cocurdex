import { buildNoteDocExtensions, NOTE_DOC_FIELD } from "@cocurdex/note-doc";
import {
  decodeNoteDocBytes,
  encodeNoteDocBytes,
} from "@cocurdex/note-doc/bytes";
import { Editor, type Editor as EditorType, Extension } from "@tiptap/core";
import Collaboration from "@tiptap/extension-collaboration";
import { Placeholder } from "@tiptap/extensions";
import { Plugin } from "@tiptap/pm/state";
import * as Y from "yjs";
import type {
  NoteBlockStyle,
  NoteEditorCommand,
  NoteEditorFormatState,
  NoteEditorInbound,
  NoteEditorOutbound,
  NoteEditorTheme,
  NoteInsertKind,
} from "../../src/notes/editor/note-editor-protocol";
import { createCodeHighlight } from "./code-highlight";

declare global {
  interface Window {
    ReactNativeWebView: { postMessage(data: string): void };
    noteEditor: { receive(message: NoteEditorInbound): void };
  }
}

const REMOTE_ORIGIN = Symbol("note-doc-remote");
const BASE_FONT_SIZE = 17;

function post(message: NoteEditorOutbound) {
  window.ReactNativeWebView.postMessage(JSON.stringify(message));
}

function element<T extends HTMLElement>(id: string) {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing #${id}`);
  return found as T;
}

const titleField = element<HTMLTextAreaElement>("title");
const metaButton = element<HTMLButtonElement>("meta");
const bodyHost = element<HTMLDivElement>("body");

let doc: Y.Doc | null = null;
let editor: EditorType | null = null;
let lastFormat = "";
const codeHighlight = createCodeHighlight((requests) =>
  post({ type: "highlight", requests }),
);

function applyTheme({ colors, fontScale }: NoteEditorTheme) {
  const root = document.documentElement.style;
  for (const [name, value] of Object.entries(colors)) {
    root.setProperty(`--${name}`, value);
  }
  root.setProperty("--font-size", `${BASE_FONT_SIZE * fontScale}px`);
}

function fitTitle() {
  titleField.style.height = "auto";
  titleField.style.height = `${titleField.scrollHeight}px`;
}

function blockStyle(current: EditorType): NoteBlockStyle {
  if (current.isActive("codeBlock")) return "codeBlock";
  if (current.isActive("blockquote")) return "blockquote";
  for (const level of [1, 2, 3] as const) {
    if (current.isActive("heading", { level })) return `heading${level}`;
  }
  return "paragraph";
}

function reportFormat(current: EditorType) {
  const format: NoteEditorFormatState = {
    block: blockStyle(current),
    marks: {
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      strike: current.isActive("strike"),
      code: current.isActive("code"),
    },
    bulletList: current.isActive("bulletList"),
    taskList: current.isActive("taskList"),
    link: current.isActive("link")
      ? String(current.getAttributes("link").href ?? "")
      : null,
  };
  const serialized = JSON.stringify(format);
  if (serialized === lastFormat) return;
  lastFormat = serialized;
  post({ type: "format", format });
}

function removeSlash(current: EditorType) {
  const { from } = current.state.selection;
  const before = current.state.doc.textBetween(Math.max(0, from - 1), from);
  if (before === "/")
    current.commands.deleteRange({ from: from - 1, to: from });
}

function setBlock(current: EditorType, style: NoteBlockStyle) {
  const chain = current.chain().focus();
  if (style === "paragraph") return chain.setParagraph().run();
  if (style === "blockquote") return chain.toggleBlockquote().run();
  if (style === "codeBlock") return chain.toggleCodeBlock().run();
  const level = Number(style.slice("heading".length)) as 1 | 2 | 3;
  return chain.setHeading({ level }).run();
}

function insert(current: EditorType, kind: NoteInsertKind) {
  const chain = current.chain().focus();
  if (kind === "bulletList") return chain.toggleBulletList().run();
  if (kind === "orderedList") return chain.toggleOrderedList().run();
  if (kind === "taskList") return chain.toggleTaskList().run();
  if (kind === "horizontalRule") return chain.setHorizontalRule().run();
  return chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
}

function run(command: NoteEditorCommand) {
  const current = editor;
  if (!current) return;
  if (command.name === "blur") {
    titleField.blur();
    current.commands.blur();
    return;
  }
  if (command.name === "dismissSlash") return;
  if ("fromSlash" in command && command.fromSlash) removeSlash(current);
  if (command.name === "block") setBlock(current, command.style);
  else if (command.name === "insert") insert(current, command.kind);
  else if (command.name === "list") insert(current, command.kind);
  else if (command.name === "mark") {
    current.chain().focus().toggleMark(command.mark).run();
  } else if (command.href) {
    current
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: command.href })
      .run();
  } else {
    current.chain().focus().extendMarkRange("link").unsetLink().run();
  }
}

const SlashTrigger = Extension.create({
  name: "slashTrigger",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleTextInput(view, from, _to, text) {
            if (text !== "/") return false;
            const $from = view.state.doc.resolve(from);
            const empty = $from.parent.textContent.trim() === "";
            if (empty) queueMicrotask(() => post({ type: "slash" }));
            return false;
          },
        },
      }),
    ];
  },
});

function imageView({ node }: { node: { attrs: Record<string, unknown> } }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "doc-image";
  button.contentEditable = "false";
  const alt = String(node.attrs.alt ?? "");
  const src = String(node.attrs.src ?? "");
  button.textContent = alt || src.split("/").pop() || "";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    post({ type: "openImage", src, alt });
  });
  return { dom: button };
}

function linkTarget(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof Element)) return null;
  return target.closest("a")?.getAttribute("href") ?? null;
}

function start(message: Extract<NoteEditorInbound, { type: "init" }>) {
  applyTheme(message.theme);
  titleField.value = message.title;
  titleField.placeholder = message.titlePlaceholder;
  metaButton.textContent = message.meta;
  titleField.readOnly = !message.editable;
  metaButton.disabled = !message.interactive;
  fitTitle();
  doc = new Y.Doc();
  Y.applyUpdate(doc, decodeNoteDocBytes(message.state), REMOTE_ORIGIN);
  doc.on("update", (update: Uint8Array, origin: unknown) => {
    if (origin === REMOTE_ORIGIN) return;
    post({ type: "update", update: encodeNoteDocBytes(update) });
  });
  editor = new Editor({
    element: bodyHost,
    editable: message.editable,
    extensions: [
      ...buildNoteDocExtensions({ collaborative: true, imageView }),
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === "paragraph" ? message.bodyPlaceholder : "",
      }),
      Collaboration.configure({ document: doc, field: NOTE_DOC_FIELD }),
      SlashTrigger,
      codeHighlight.extension,
    ],
    editorProps: {
      attributes: { class: "prose", autocapitalize: "sentences" },
      handleClick(_view, _pos, event) {
        const href = linkTarget(event);
        if (!href) return false;
        event.preventDefault();
        post({ type: "openLink", href });
        return true;
      },
    },
    onTransaction: ({ editor: current }) => reportFormat(current),
    onFocus: ({ editor: current }) => {
      post({ type: "focus", focused: true });
      reportFormat(current);
    },
    onBlur: () => {
      if (document.activeElement !== titleField) {
        post({ type: "focus", focused: false });
      }
    },
  });
  if (message.focusTitle && message.editable) {
    titleField.focus();
    titleField.select();
  }
}

function setEditable(editable: boolean) {
  titleField.readOnly = !editable;
  if (!editable) {
    titleField.blur();
    editor?.commands.blur();
  }
  editor?.setEditable(editable);
}

titleField.addEventListener("input", () => {
  const brokeLine = titleField.value.includes("\n");
  if (brokeLine) titleField.value = titleField.value.replace(/\n/g, "");
  fitTitle();
  post({ type: "title", title: titleField.value });
  if (brokeLine) editor?.commands.focus("start");
});
titleField.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  editor?.commands.focus("start");
});
titleField.addEventListener("focus", () =>
  post({ type: "focus", focused: true }),
);
titleField.addEventListener("blur", () => {
  if (!editor?.isFocused) post({ type: "focus", focused: false });
});
metaButton.addEventListener("click", () => post({ type: "properties" }));
window.addEventListener("resize", fitTitle);

window.noteEditor = {
  receive(message) {
    if (message.type === "init") {
      if (!editor) start(message);
    } else if (message.type === "remote") {
      if (doc) {
        Y.applyUpdate(doc, decodeNoteDocBytes(message.update), REMOTE_ORIGIN);
      }
    } else if (message.type === "title") {
      if (document.activeElement !== titleField) {
        titleField.value = message.title;
        fitTitle();
      }
    } else if (message.type === "meta") {
      metaButton.textContent = message.meta;
    } else if (message.type === "editable") {
      setEditable(message.editable);
    } else if (message.type === "theme") {
      applyTheme(message.theme);
      codeHighlight.reset();
    } else if (message.type === "highlighted") {
      codeHighlight.receive(message.id, message.tokens);
    } else {
      run(message.command);
    }
  },
};

post({ type: "ready" });
