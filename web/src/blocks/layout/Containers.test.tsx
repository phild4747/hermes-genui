/// <reference types="vite/client" />
import { cleanup, render } from "@testing-library/react";
import layoutCss from "./layout.css?raw";
import { afterEach, describe, expect, it } from "vitest";
import catalog from "../../../../core/catalog.json";
import { Blocks } from "../../core/Blocks";
import { readBlocks } from "../../core/readBlocks";

afterEach(cleanup);

const example = (kind: string) => catalog.blocks.find((b) => b.kind === kind)!.example;

describe("columns", () => {
  it("draws two architecture flows in separate columns", () => {
    const flow = (title: string, prefix: string) => ({
      type: "flow", title, direction: "down",
      nodes: [
        { id: `${prefix}-input`, label: "Input" },
        { id: `${prefix}-output`, label: "Output" },
      ],
    });
    const blocks = readBlocks([{
      type: "columns", children: [flow("Local", "local"), flow("Hosted", "hosted")],
    }]);
    const { container } = render(<Blocks blocks={blocks} />);
    const cells = container.querySelectorAll(".hb-columns > .hb-column");
    expect(cells.length).toBe(2);
    for (const cell of cells) {
      expect(cell.querySelector(".hb-flow-down")).toBeTruthy();
      expect(cell.querySelectorAll(".hb-flow-node").length).toBe(2);
    }
    expect(cells[0].textContent).toContain("Local");
    expect(cells[1].textContent).toContain("Hosted");
  });

  it("draws each child in its own column", () => {
    const { container } = render(<Blocks blocks={readBlocks([example("columns")])} />);
    expect(container.querySelectorAll(".hb-columns > .hb-column").length).toBe(2);
    expect(container.querySelector(".hb-columns .hb-chart")).toBeTruthy();
    expect(container.querySelector(".hb-columns .hb-table")).toBeTruthy();
  });
});

describe("rows", () => {
  it("let small pieces (badge, link) keep their own width", () => {
    const blocks = readBlocks([{ type: "row", children: [{ type: "badge", text: "Open now", tone: "good" }, { type: "link", text: "Book", url: "https://www.irctc.co.in" }, { type: "stat", label: "Seats", value: 12 }] }]);
    const { container } = render(<Blocks blocks={blocks} />);
    const cells = [...container.querySelectorAll(".hb-row > div")].map((c) => c.className);
    expect(cells).toEqual(["hb-row-cell hb-row-cell-own", "hb-row-cell hb-row-cell-own", "hb-row-cell"]);
  });

  it("columns never ask for more width than a phone has", () => {
    expect(layoutCss).toContain("minmax(min(380px, 100%), 1fr)");
    expect(layoutCss).not.toMatch(/minmax\(380px/);
  });
});

