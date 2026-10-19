import { act, renderHook } from "@testing-library/react";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { useDeckImageUrl } from "@/features/decks/deck-image-urls";

vi.mock("@/lib", () => ({
  logRendererDiagnostic: vi.fn(),
  resolveLocalDaemonConnection: async () => ({
    webSocketUrl: "ws://127.0.0.1:4100/ws",
    token: "test-token",
  }),
}));

const fetchMock = vi.fn();

function failOnce() {
  fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
}

function succeedOnce() {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    blob: async () => new Blob(["png"]),
  });
}

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeAll(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
  URL.createObjectURL = vi.fn(() => "blob:deck-image");
  URL.revokeObjectURL = vi.fn();
});

afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  fetchMock.mockReset();
});

describe("deck image urls", () => {
  it("retries a failed load while the image is still shown", async () => {
    failOnce();
    succeedOnce();
    const { result } = renderHook(() => useDeckImageUrl("hash-retry"));
    await flush();
    expect(result.current).toBeNull();
    await flush(1_000);
    expect(result.current).toBe("blob:deck-image");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("loads again for a new viewer after retries run out", async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) failOnce();
    const first = renderHook(() => useDeckImageUrl("hash-exhausted"));
    await flush(20_000);
    expect(first.result.current).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(4);

    succeedOnce();
    const second = renderHook(() => useDeckImageUrl("hash-exhausted"));
    await flush();
    expect(second.result.current).toBe("blob:deck-image");
    expect(first.result.current).toBe("blob:deck-image");
  });
});
