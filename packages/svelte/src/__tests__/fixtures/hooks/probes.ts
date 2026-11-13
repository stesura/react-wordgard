// What the decoration-hook tests' components report and obey, and the table tests' shared pieces.
import { Mark, Node, type Plot } from "wordgard/doc";
import type { Wordgard } from "wordgard/editor";
import { BlockCell } from "wordgard/types";

export const seen: {
  positions: Map<string, () => number>;
  selections: string[];
  stopped: string[];
  listened: string[];
} = { positions: new Map(), selections: [], stopped: [], listened: [] };

export const obey = { ignore: false, handle: false, ignoreAll: false };

export const mounts = { picture: 0 };

// Stops every mousedown.
export const stopMousedown = (_: Wordgard, event: Event) => {
  if (event.type != "mousedown") return false;
  if (event.target instanceof Element) seen.stopped.push(`stopped ${event.target.nodeName}`);
  return true;
};

export const resetProbes = () => {
  seen.positions.clear();
  seen.selections.length = 0;
  seen.stopped.length = 0;
  seen.listened.length = 0;
  Object.assign(obey, { ignore: false, handle: false, ignoreAll: false });
  mounts.picture = 0;
};

export const ColWidth = Mark.Type.define<readonly number[]>("ColWidth", {
  target: BlockCell,
  validate: (value) => {
    if (!Array.isArray(value) || value.some((n) => typeof n != "number"))
      throw new RangeError("Not widths");
  },
  shape: {
    attribute: "data-colwidth",
    value: (widths) => widths.join(","),
    readAttribute: (value) => value.split(",").map(Number),
  },
});

export const isPlot = (node: Node): node is Plot => node.isPlot;

// The first row's widths, a column per entry.
export const columnsOf = (table: Node) => {
  const row = isPlot(table) ? table.content[0] : undefined;
  return (row && isPlot(row) ? row.content : []).flatMap((cell) => cell.mark(ColWidth) ?? [0]);
};

// What a row hands its cells: how many there are.
export const RowCells = Symbol("rowCells");

export type RowCellsValue = { readonly current: number };
