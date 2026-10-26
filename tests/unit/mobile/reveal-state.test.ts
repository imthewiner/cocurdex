import {
  nextReveal,
  type Reveal,
} from "@cocurdex/mobile/internal/markdown/reveal-state";
import { describe, expect, it } from "vitest";

const TEXT = "a".repeat(40);

function paced(shown: number, at: number | null): Reveal {
  return { shown, at, pacing: true };
}

describe("nextReveal", () => {
  it("shows a message that never streamed in full", () => {
    expect(
      nextReveal({ shown: 3, at: null, pacing: false }, TEXT, false, 0),
    ).toEqual({ shown: TEXT.length, at: null, pacing: false });
  });

  it("starts the clock before revealing anything", () => {
    expect(nextReveal(paced(10, null), TEXT, true, 500)).toEqual(
      paced(10, 500),
    );
  });

  it("reveals at the shared pace on each tick", () => {
    expect(nextReveal(paced(10, 500), TEXT, true, 550)).toEqual(paced(15, 550));
  });

  it("does not jump after the clock was idle", () => {
    expect(nextReveal(paced(0, 500), TEXT, true, 60_000).shown).toBe(9);
  });

  it("keeps pacing after the stream ends until it catches up", () => {
    const tail = nextReveal(paced(30, 500), TEXT, false, 550);
    expect(tail).toEqual(paced(35, 550));
    const done = nextReveal(paced(TEXT.length, 550), TEXT, false, 600);
    expect(done).toEqual({ shown: TEXT.length, at: null, pacing: false });
  });

  it("waits at the end of the text while the stream is open", () => {
    expect(nextReveal(paced(TEXT.length, 500), TEXT, true, 550)).toEqual(
      paced(TEXT.length, null),
    );
  });
});
