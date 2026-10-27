import type { NoteRecord } from "@cocurdex/shared";
import { useSyncExternalStore } from "react";
import { mutate } from "swr";
import { hostConnection } from "@/connection";
import { createNoteDocSession, type NoteDocSession } from "./note-doc-session";

interface Entry {
  session: NoteDocSession;
  subscribe(listener: () => void): () => void;
  setTitle(title: string): void;
  discardWhenBlank(): void;
}

const entries = new Map<string, Entry>();

function cacheSavedNote(hostId: string, note: NoteRecord) {
  void mutate(["note.get", hostId, note.id], note, { revalidate: false });
}

function createEntry(hostId: string, noteId: string): Entry {
  const key = `${hostId}:${noteId}`;
  const connection = hostConnection(hostId);
  let savedTitle: string | null = null;
  const session = createNoteDocSession(
    {
      getDoc: (stateVector) =>
        connection.request(
          "note.getDoc",
          stateVector ? { id: noteId, stateVector } : { id: noteId },
        ),
      applyDocUpdate: (update) =>
        connection.request("note.applyDocUpdate", { id: noteId, update }),
      updateTitle: (title) =>
        connection.request("note.update", { id: noteId, title }),
    },
    (note) => {
      cacheSavedNote(hostId, note);
      if (note.title === savedTitle) return;
      savedTitle = note.title;
      void mutate(["note.list", hostId]);
    },
  );
  let subscribers = 0;
  let stop: (() => void) | null = null;
  let title = "";
  let disposable = false;

  const discardIfBlank = async () => {
    if (!disposable || title.trim() !== "" || !session.isBlank()) return;
    await connection.request("note.delete", { id: noteId });
    void mutate(["note.list", hostId]);
  };

  const start = () => {
    void session.load();
    const stopEvents = connection.onEvent((event) => {
      if (event.type === "data.changed" && event.areas.includes("notes")) {
        void session.pull().catch(() => undefined);
      }
    });
    const stopState = connection.subscribeState((state) => {
      if (state.status === "live") void session.pull().catch(() => undefined);
    });
    stop = () => {
      stopEvents();
      stopState();
    };
  };

  const finish = () => {
    stop?.();
    stop = null;
    session.detach();
    void session
      .flush()
      .then(() => (subscribers === 0 ? discardIfBlank() : undefined))
      .catch(() => undefined)
      .finally(() => {
        if (subscribers === 0 && entries.get(key)?.session === session) {
          entries.delete(key);
        }
      });
  };

  return {
    session,
    subscribe(listener) {
      const unsubscribe = session.subscribe(listener);
      subscribers += 1;
      if (subscribers === 1 && !stop) start();
      return () => {
        unsubscribe();
        subscribers -= 1;
        if (subscribers === 0) finish();
      };
    },
    setTitle(next) {
      title = next;
      session.setTitle(next);
    },
    discardWhenBlank() {
      disposable = true;
    },
  };
}

function entryFor(hostId: string, noteId: string) {
  const key = `${hostId}:${noteId}`;
  let entry = entries.get(key);
  if (!entry) {
    entry = createEntry(hostId, noteId);
    entries.set(key, entry);
  }
  return entry;
}

export function discardNoteWhenBlank(hostId: string, noteId: string) {
  entryFor(hostId, noteId).discardWhenBlank();
}

export function useNoteDocSession(hostId: string, noteId: string) {
  const entry = entryFor(hostId, noteId);
  const snapshot = useSyncExternalStore(
    entry.subscribe,
    entry.session.snapshot,
  );
  return { session: entry.session, setTitle: entry.setTitle, ...snapshot };
}
