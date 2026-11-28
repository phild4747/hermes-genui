import { afterEach, describe, expect, it, vi } from "vitest";
import {
  forgetBoards,
  loadBoardState,
  migrateArchived,
  promoteOnUpdate,
  recordValue,
  forgetBlock,
} from "./savedState";

afterEach(() => {
  forgetBoards();
});

describe("archive migration lifecycle", () => {
  it("does not save an abandoned migration after reopening", async () => {
    const key = "a3000001";

    const previous = [{
      type: "checklist",
      title: "Tasks",
      items: ["Alpha", "Bravo"],
      path: "0",
    }];

    const current = [
      { type: "heading", text: "New heading" },
      { ...previous[0], path: "1" },
    ];

    let server: Record<string, unknown> = { "0": [0] };

    const rest = vi.fn(async (
      _path: string,
      init?: { method?: string; body?: unknown },
    ) => {
      if (init?.method === "PUT") {
        server = {
          ...(init.body as {
            state: Record<string, unknown>
          }).state,
        };
      }
      return { state: { ...server } };
    });

    let finishArchive!: (blocks: unknown[]) => void;
    const archive = new Promise<unknown[]>(resolve => {
      finishArchive = resolve;
    });

    let archiveStarted!: () => void;
    const started = new Promise<void>(resolve => {
      archiveStarted = resolve;
    });

    const loadVersion = vi.fn(async () => {
      archiveStarted();
      return archive;
    });


    const migrating = migrateArchived(
      rest, key, loadVersion, current, 2
    );

    await started;

    // Close the last view while its archive request is pending.
    forgetBlock(key);

    // Another client changes the saved state.
    server = { "0": [1] };


    expect(await loadBoardState(rest, key))
      .toEqual({ "0": [1] });

    // The abandoned request finally completes.
    finishArchive(previous);
    await migrating;

    expect(
      rest.mock.calls.filter(
        ([, init]) => init?.method === "PUT"
      )
    ).toHaveLength(0);

    expect(server).toEqual({ "0": [1] });

    forgetBlock(key);
  });
});


describe("update promotion lifecycle", () => {
  it("does not promote an old update into a replacement cache", async () => {
    const id = "a3000002";

    let finishGet!: (answer: unknown) => void;
    const pending = new Promise<unknown>(resolve => {
      finishGet = resolve;
    });

    const rest = vi.fn()
      .mockReturnValueOnce(pending)
      .mockResolvedValue({ state: { "0": [1] } });

    const previous = [{
      type: "checklist",
      items: ["Alpha", "Bravo"],
      path: "0",
    }];

    // The old view holds a local answer.
    recordValue(undefined, id, "abc123:0", "0", [0], "never");

    const promoting = promoteOnUpdate(
      rest, id, previous, previous
    );

    forgetBlock(id);

    // The replacement view retrieves newer server state.
    expect(await loadBoardState(rest, id))
      .toEqual({ "0": [1] });

    // The old request completes after the replacement is ready.
    finishGet({ state: { "0": [0] } });
    await promoting;

    expect(
      rest.mock.calls.filter(
        ([, init]) => init?.method === "PUT"
      )
    ).toHaveLength(0);

    expect(await loadBoardState(rest, id))
      .toEqual({ "0": [1] });

    forgetBlock(id);
  });
});
