import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  forgetBoards,
  forgetBlock,
  loadBoardState,
  recordValue,
  saveBoardValue,
} from "./savedState";

describe("board state across reopened views", () => {
  beforeEach(() => forgetBoards());

  it("refreshes server state after the last view releases a board", async () => {
    const id = "e4c5f681";
    let server = { travel: 340 };

    const rest = vi.fn(async () => ({
      state: { ...server },
    }));

    expect(await loadBoardState(rest, id))
      .toEqual({ travel: 340 });

    // Multiple controls on one mounted board share a single GET.
    await loadBoardState(rest, id);
    expect(rest).toHaveBeenCalledTimes(1);

    forgetBlock(id);

    // Another window edits the board.
    server = { travel: 1450 };

    expect(await loadBoardState(rest, id))
      .toEqual({ travel: 1450 });

    expect(rest).toHaveBeenCalledTimes(2);
  });

  it("waits for an outstanding save before refreshing", async () => {
    const id = "e4c5f682";
    let server: Record<string, unknown> = { travel: 340 };
    const events: string[] = [];

    let finishPut!: () => void;
    const putGate = new Promise<void>(resolve => {
      finishPut = resolve;
    });

    let startPut!: () => void;
    const putStarted = new Promise<void>(resolve => {
      startPut = resolve;
    });

    const rest = vi.fn(async (
      _path: string,
      init?: { method?: string; body?: unknown },
    ) => {
      if (init?.method === "PUT") {
        events.push("PUT start");
        startPut();
        await putGate;
        server = {
          ...(init.body as {
            state: Record<string, unknown>
          }).state,
        };
        events.push("PUT complete");
      } else {
        events.push("GET");
      }

      return { state: { ...server } };
    });

    await loadBoardState(rest, id);

    const saving = saveBoardValue(rest, id, "travel", 1450);
    await putStarted;

    forgetBlock(id);
    const reopened = loadBoardState(rest, id);

    finishPut();
    await saving;

    expect(await reopened).toEqual({ travel: 1450 });
    expect(events).toEqual([
      "GET",
      "PUT start",
      "PUT complete",
      "GET",
    ]);
  });
});

describe("immediate board handoffs", () => {
  beforeEach(() => forgetBoards());

  it("flushes a queued slider edit before reopening", async () => {
    const id = "e4c5f683";
    let server: Record<string, unknown> = { travel: 340 };
    const events: string[] = [];

    const rest = vi.fn(async (
      _path: string,
      init?: { method?: string; body?: unknown },
    ) => {
      if (init?.method === "PUT") {
        events.push("PUT");
        server = {
          ...(init.body as {
            state: Record<string, unknown>
          }).state,
        };
      } else {
        events.push("GET");
      }
      return { state: { ...server } };
    });

    await loadBoardState(rest, id);

    recordValue(rest, id, "slider", "travel", 1200, "coalesce");
    recordValue(rest, id, "slider", "travel", 1450, "coalesce");

    // Release immediately, without waiting for the debounce timer.
    forgetBlock(id);

    expect(await loadBoardState(rest, id))
      .toEqual({ travel: 1450 });

    expect(server.travel).toBe(1450);
    expect(events).toEqual(["GET", "PUT", "GET"]);
  });

  it("shares a single fresh GET among reopened controls", async () => {
    const id = "e4c5f684";
    let travel = 340;

    const rest = vi.fn(async () => ({
      state: { travel },
    }));

    await loadBoardState(rest, id);
    forgetBlock(id);

    travel = 1450;

    const results = await Promise.all([
      loadBoardState(rest, id),
      loadBoardState(rest, id),
      loadBoardState(rest, id),
    ]);

    expect(results).toEqual([
      { travel: 1450 },
      { travel: 1450 },
      { travel: 1450 },
    ]);

    expect(rest).toHaveBeenCalledTimes(2);
  });
});


describe("asynchronous board handoffs", () => {
  beforeEach(() => forgetBoards());

  it("preserves a save queued during the initial state load", async () => {
    const id = "e4c5f685";
    let server: Record<string, unknown> = { travel: 340, other: 7 };
    const events: string[] = [];

    let finishGet!: () => void;
    const gate = new Promise<void>(resolve => {
      finishGet = resolve;
    });

    const rest = vi.fn(async (
      _path: string,
      init?: { method?: string; body?: unknown },
    ) => {
      if (init?.method === "PUT") {
        events.push("PUT");
        server = {
          ...(init.body as { state: Record<string, unknown> }).state,
        };
      } else {
        events.push("GET");
        if (events.length === 1) await gate;
      }
      return { state: { ...server } };
    });

    const initial = loadBoardState(rest, id);
    const saving = saveBoardValue(rest, id, "travel", 1450);

    forgetBlock(id);
    const reopened = loadBoardState(rest, id);

    finishGet();

    await initial;
    await saving;

    expect(await reopened).toEqual({ travel: 1450, other: 7 });
    expect(events).toEqual(["GET", "PUT", "GET"]);
  });

  it("preserves pending writes across repeated rapid reopenings", async () => {
    const id = "e4c5f686";
    let server: Record<string, unknown> = { travel: 340 };
    const events: string[] = [];

    let finishPut!: () => void;
    const gate = new Promise<void>(resolve => {
      finishPut = resolve;
    });

    let startPut!: () => void;
    const started = new Promise<void>(resolve => {
      startPut = resolve;
    });

    const rest = vi.fn(async (
      _path: string,
      init?: { method?: string; body?: unknown },
    ) => {
      if (init?.method === "PUT") {
        events.push("PUT start");
        startPut();
        await gate;
        server = {
          ...(init.body as { state: Record<string, unknown> }).state,
        };
        events.push("PUT complete");
      } else {
        events.push("GET");
      }
      return { state: { ...server } };
    });

    await loadBoardState(rest, id);

    const saving = saveBoardValue(rest, id, "travel", 1450);
    await started;

    forgetBlock(id);
    const firstReopen = loadBoardState(rest, id);

    forgetBlock(id);
    const secondReopen = loadBoardState(rest, id);

    finishPut();

    await saving;

    expect(await firstReopen).toEqual({ travel: 1450 });
    expect(await secondReopen).toEqual({ travel: 1450 });
    expect(events).toEqual([
      "GET",
      "PUT start",
      "PUT complete",
      "GET",
      "GET",
    ]);
  });

  it("does not let an older failed load evict a reopened cache", async () => {
    const id = "e4c5f687";

    let failGet!: (reason: Error) => void;
    const pending = new Promise<unknown>((_resolve, reject) => {
      failGet = reject;
    });

    const rest = vi.fn()
      .mockReturnValueOnce(pending)
      .mockResolvedValue({ state: { travel: 1450 } });

    const initial = loadBoardState(rest, id);

    forgetBlock(id);
    const reopened = loadBoardState(rest, id);

    failGet(new Error("offline"));

    expect(await initial).toEqual({});
    expect(await reopened).toEqual({ travel: 1450 });
    expect(await loadBoardState(rest, id)).toEqual({ travel: 1450 });
    expect(rest).toHaveBeenCalledTimes(2);
  });
});
