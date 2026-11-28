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


describe("failed save recovery", () => {
  beforeEach(() => forgetBoards());

  it("preserves an unsaved edit without masking unrelated server changes", async () => {
    const id = "e4c5f690";
    let server = { travel: 340, other: 7 };

    const rest = vi.fn(async (
      _path: string,
      init?: { method?: string; body?: unknown },
    ) => {
      if (init?.method === "PUT") {
        throw new Error("Save failed");
      }
      return { state: { ...server } };
    });

    await loadBoardState(rest, id);
    await saveBoardValue(rest, id, "travel", 1450);

    forgetBlock(id);

    // Another client changes an unrelated value.
    server = { travel: 340, other: 9 };

    const reopened = await loadBoardState(rest, id);

    expect(
      rest.mock.calls.filter(
        ([, init]) => init?.method === "PUT"
      )
    ).toHaveLength(1);

    expect(server.travel).toBe(340);
    expect(reopened.other).toBe(9);
    expect(reopened.travel).toBe(1450);
  });

  it("accepts fresh server values after a subsequent successful save", async () => {
    const id = "e4c5f691";
    let server: Record<string, unknown> = { travel: 340 };
    let fail = true;

    const rest = vi.fn(async (
      _path: string,
      init?: { method?: string; body?: unknown },
    ) => {
      if (init?.method === "PUT") {
        if (fail) throw new Error("Save failed");

        server = {
          ...(init.body as {
            state: Record<string, unknown>
          }).state,
        };
      }

      return { state: { ...server } };
    });

    await loadBoardState(rest, id);
    await saveBoardValue(rest, id, "travel", 1450);

    fail = false;

    await saveBoardValue(rest, id, "travel", 1600);
    expect(server.travel).toBe(1600);

    forgetBlock(id);

    // Another client changes the successfully saved value.
    server = { travel: 1800 };

    expect(await loadBoardState(rest, id))
      .toEqual({ travel: 1800 });
  });
});


describe("failed save reconciliation edge cases", () => {
  beforeEach(() => forgetBoards());

  it.each([
    ["remote conflict", "e4c5f692", 1800],
    ["lost acknowledgement", "e4c5f693", 1450],
  ] as const)("reconciles a %s", async (_scenario, id, remote) => {
    let server = { travel: 340 };

    const rest = vi.fn(async (
      _path: string,
      init?: { method?: string; body?: unknown },
    ) => {
      if (init?.method === "PUT") {
        throw new Error("Save failed");
      }
      return { state: { ...server } };
    });

    await loadBoardState(rest, id);
    await saveBoardValue(rest, id, "travel", 1450);

    forgetBlock(id);
    server = { travel: remote };

    expect(await loadBoardState(rest, id))
      .toEqual({ travel: remote });

    // Reconciled edits must not reappear on later openings.
    forgetBlock(id);
    server = { travel: 340 };

    expect(await loadBoardState(rest, id))
      .toEqual({ travel: 340 });

    expect(
      rest.mock.calls.filter(
        ([, init]) => init?.method === "PUT"
      )
    ).toHaveLength(1);
  });

  it("retains failed edits through a failed refresh", async () => {
    const id = "e4c5f694";
    let offline = false;

    const rest = vi.fn(async (
      _path: string,
      init?: { method?: string; body?: unknown },
    ) => {
      if (offline || init?.method === "PUT") {
        throw new Error("Offline");
      }
      return { state: { travel: 340, other: 7 } };
    });

    await loadBoardState(rest, id);
    await saveBoardValue(rest, id, "travel", 1450);

    forgetBlock(id);

    offline = true;
    expect(await loadBoardState(rest, id)).toEqual({});

    offline = false;

    expect(await loadBoardState(rest, id))
      .toEqual({ travel: 1450, other: 7 });
  });

  it("carries a pending save failure through rapid reopenings", async () => {
    const id = "e4c5f695";

    let rejectPut!: (reason: Error) => void;
    const pendingPut = new Promise<unknown>((_resolve, reject) => {
      rejectPut = reject;
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
        startPut();
        return pendingPut;
      }
      return { state: { travel: 340 } };
    });

    await loadBoardState(rest, id);

    const saving = saveBoardValue(rest, id, "travel", 1450);
    await started;

    forgetBlock(id);
    const first = loadBoardState(rest, id);

    forgetBlock(id);
    const second = loadBoardState(rest, id);

    rejectPut(new Error("Save failed"));

    await saving;

    expect(await first).toEqual({ travel: 1450 });
    expect(await second).toEqual({ travel: 1450 });

    expect(
      rest.mock.calls.filter(
        ([, init]) => init?.method === "PUT"
      )
    ).toHaveLength(1);
  });

  it("clears failed edits included in a later successful whole-board save", async () => {
    const id = "e4c5f696";
    let server: Record<string, unknown> = {
      travel: 340,
      other: 7,
    };

    let fail = true;

    const rest = vi.fn(async (
      _path: string,
      init?: { method?: string; body?: unknown },
    ) => {
      if (init?.method === "PUT") {
        if (fail) throw new Error("Save failed");

        server = {
          ...(init.body as {
            state: Record<string, unknown>
          }).state,
        };
      }

      return { state: { ...server } };
    });

    await loadBoardState(rest, id);
    await saveBoardValue(rest, id, "travel", 1450);

    forgetBlock(id);

    expect(await loadBoardState(rest, id))
      .toEqual({ travel: 1450, other: 7 });

    fail = false;
    await saveBoardValue(rest, id, "other", 9);

    expect(server).toEqual({ travel: 1450, other: 9 });

    forgetBlock(id);
    server = { travel: 1800, other: 10 };

    expect(await loadBoardState(rest, id))
      .toEqual({ travel: 1800, other: 10 });
  });
});
