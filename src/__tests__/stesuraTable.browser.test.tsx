// A table drawn as Stesura draws one: a React table shape with a colgroup before its tbody, a
// wrapper around it, React rows, and React cells drawn `td` or `th` per tag (a header mark), with
// chrome before an always-present content element (pagination's slots). After each change, a
// flush must find nothing to redraw, and the drawing must be a fresh editor's.
import React, { type ReactNode, createContext, useContext } from "react";
import { Mark, Node, type Plot } from "wordgard/doc";
import { Decoration, type Wordgard } from "wordgard/editor";
import { basicSchema } from "wordgard/schema";
import { GardState } from "wordgard/state";
import { CellSelection } from "wordgard/table";
import { BlockCell, ColSpan, Paragraph, RowSpan, Table, TableRow } from "wordgard/types";

import { ReactWordgard } from "../ReactWordgard.js";
import { DecorationRoot } from "../components/DecorationRoot.js";
import { createShape } from "../decorations/ReactShapeType.js";
import { createWrapper } from "../decorations/ReactWrapperType.js";
import { drawn, flushKeeps, textIn, typeInto } from "../testing/editing.js";

const HeaderCell = Mark.define("HeaderCell", {
  target: BlockCell,
  // Wordgard's parser skips an empty attribute value.
  shape: { attribute: "data-header", value: "true" },
});

const ColWidth = Mark.Type.define<readonly number[]>("ColWidth", {
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

const Id = Mark.Type.define<string>("Id", {
  target: Node.Group.Block,
  validate: "string",
  shape: { attribute: "id", value: 0 },
});

// The first row's widths, a column per entry.
const columnsOf = (table: Plot) => {
  const row = table.content[0] as Plot | undefined;
  return (row?.content ?? []).flatMap((cell) => cell.mark(ColWidth) ?? [0]);
};

const TableView = createShape(function TableView({ nodeProps, children }) {
  return (
    <DecorationRoot>
      <colgroup>
        {columnsOf(nodeProps.node as Plot).map((width, i) => (
          <col key={i} style={{ width: `${width}px` }} />
        ))}
      </colgroup>
      <tbody ref={nodeProps.contentDOMRef}>{children}</tbody>
    </DecorationRoot>
  );
});

const Scroller = createWrapper(function Scroller({ children }) {
  return (
    <DecorationRoot className="tableWrapper">
      <span className="grip" aria-hidden="true">
        ⋮
      </span>
      {children}
    </DecorationRoot>
  );
});

const RowIndex = createContext(-1);

const RowView = createShape(function RowView({ nodeProps, children }) {
  return (
    <RowIndex.Provider value={(nodeProps.node as Plot).content.length}>
      <DecorationRoot>{children}</DecorationRoot>
    </RowIndex.Provider>
  );
});

// Chrome before the content: pagination's slots, here a label from the row.
const Slot = ({ children }: { children: ReactNode }) => (
  <div className="slot" aria-hidden="true">
    {children}
  </div>
);

const CellView = createShape(function CellView({ nodeProps, children }) {
  const cells = useContext(RowIndex);
  return (
    <DecorationRoot>
      <Slot>{cells}</Slot>
      <div className="cellContent" ref={nodeProps.contentDOMRef}>
        {children}
      </div>
    </DecorationRoot>
  );
});

const config = [
  basicSchema(),
  GardState.schemaElement.of([
    Table,
    TableRow,
    BlockCell,
    ColSpan,
    RowSpan,
    HeaderCell,
    ColWidth,
    Id,
  ]),
  CellSelection.extension,
  Decoration.Tag.shape(Table, TableView),
  Decoration.Tag.wrapper(Table, Scroller),
  Decoration.Tag.shape(TableRow, RowView),
  Decoration.Tag.shape(BlockCell, (tag) =>
    HeaderCell.isInSet(tag.marks) ? CellView.of("th") : CellView(tag)
  ),
];

const doc =
  "<table><tbody>" +
  '<tr><td data-header="true" data-colwidth="100" id="h1"><p>a</p></td><td data-header="true" data-colwidth="50,50" colspan="2" id="h2"><p>b</p></td></tr>' +
  '<tr><td data-colwidth="100"><p>c</p></td><td data-colwidth="50"><p>d</p></td><td data-colwidth="50"><p>e</p></td></tr>' +
  "</tbody></table><p>after</p>";

const editors: ReactWordgard[] = [];
afterEach(() => {
  for (const wg of editors.splice(0)) wg.dom.remove();
});

const create = (spec: { doc?: string; state?: GardState } = {}) => {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const wg = spec.state
    ? ReactWordgard.create({ state: spec.state, parent })
    : ReactWordgard.create({ doc: spec.doc ?? doc, config, parent });
  wg.flush();
  editors.push(wg);
  return wg;
};

const fresh = (wg: Wordgard) => drawn(create({ state: wg.state }));

// The drawing with each element's attributes sorted: a class React adds later
// comes last in the DOM, not in a fresh editor's.
const sorted = (wg: Wordgard) => {
  const copy = wg.contentDOM.cloneNode(true);
  if (!(copy instanceof Element)) throw new Error("No copy");
  for (const elt of [copy, ...copy.querySelectorAll("*")]) {
    const attrs = [...elt.attributes]
      .map((a) => [a.name, a.value] as const)
      .sort(([a], [b]) => a.localeCompare(b));
    for (const [name] of attrs) elt.removeAttribute(name);
    for (const [name, value] of attrs) elt.setAttribute(name, value);
  }
  return { tiles: drawn(wg).tiles, html: copy.innerHTML };
};

// Cell positions, document order.
const cellPositions = (wg: Wordgard) => {
  const found: number[] = [];
  wg.state.doc.iterate(0, wg.state.doc.length, (node, pos) => {
    if (node.type == BlockCell.type) found.push(pos);
    return node.type != BlockCell.type;
  });
  return found;
};

describe("A Stesura-shaped table", () => {
  it("draws the wrapper, colgroup, rows and cells, th or td per tag, with their marks' attributes", () => {
    const wg = create();
    const wrapper = wg.contentDOM.querySelector("div.tableWrapper");
    expect(wrapper?.querySelector(":scope > .grip")?.getAttribute("contenteditable")).toBe("false");
    const table = wrapper?.querySelector(":scope > table");
    expect(table?.querySelectorAll(":scope > colgroup > col").length).toBe(3);
    expect(table?.querySelector(":scope > colgroup > col")?.getAttribute("style")).toBe(
      "width: 100px;"
    );
    const header = table?.querySelectorAll(":scope > tbody > tr:first-child > th");
    expect(header?.length).toBe(2);
    expect(header?.[0]?.getAttribute("id")).toBe("h1");
    expect(header?.[1]?.getAttribute("colspan")).toBe("2");
    expect(header?.[1]?.getAttribute("id")).toBe("h2");
    expect(table?.querySelectorAll(":scope > tbody > tr:nth-child(2) > td").length).toBe(3);
    const cell = table?.querySelector("td");
    expect(cell?.querySelector(":scope > .slot")?.textContent).toBe("3");
    expect(cell?.querySelector(":scope > .cellContent > p")?.textContent).toBe("c");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("takes typing in a cell", () => {
    const wg = create();
    typeInto(wg, textIn(wg, "td .cellContent p"), 1, "x");
    wg.flush();
    expect(wg.state.doc.textContent({ blockSeparator: "|" })).toContain("cx");
    expect(flushKeeps(wg)).toBe(true);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("redraws a cell as th or td when its header mark changes", () => {
    const wg = create();
    const [, , third] = cellPositions(wg);
    if (third == null) throw new Error("No cell");
    wg.dispatch({ changes: { from: third, add: HeaderCell } });
    wg.flush();
    expect(wg.contentDOM.querySelectorAll("tr:nth-child(2) > th").length).toBe(1);
    expect(drawn(wg)).toEqual(fresh(wg));
    const [first] = cellPositions(wg);
    if (first == null) throw new Error("No cell");
    wg.dispatch({ changes: { from: first, remove: HeaderCell } });
    wg.flush();
    const cell = wg.contentDOM.querySelector("tr:first-child > td");
    expect(cell?.getAttribute("id")).toBe("h1");
    expect(cell?.querySelector(":scope > .cellContent > p")?.textContent).toBe("a");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("redraws the colgroup when a first-row cell's widths change", () => {
    const wg = create();
    const [first] = cellPositions(wg);
    if (first == null) throw new Error("No cell");
    wg.dispatch({
      changes: [
        { from: first, remove: ColWidth.of([100]) },
        { from: first, add: ColWidth.of([140]) },
      ],
    });
    wg.flush();
    expect(wg.contentDOM.querySelector("col")?.getAttribute("style")).toBe("width: 140px;");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("follows a row added and removed: the cells' chrome reads the row", () => {
    const wg = create();
    const [, , third] = cellPositions(wg);
    if (third == null) throw new Error("No cell");
    const row = wg.state.doc.resolve(third).parent;
    if (!row) throw new Error("No row");
    wg.dispatch({
      changes: { from: row.end, insert: [BlockCell.create([Paragraph.create()])] },
    });
    wg.flush();
    expect(wg.contentDOM.querySelector("tr:nth-child(2) > td > .slot")?.textContent).toBe("4");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("paints a cell selection's cells through DecorationRoot", () => {
    const wg = create();
    const cells = cellPositions(wg);
    const first = cells[0];
    const last = cells[cells.length - 1];
    if (first == null || last == null) throw new Error("No cell");
    const lastNode = wg.state.doc.nodeAt(last);
    if (!lastNode) throw new Error("No cell");
    const selection = CellSelection.between(wg.state.doc, first, last + lastNode.length);
    if (!selection) throw new Error("No cell selection");
    wg.dispatch({ selection });
    wg.flush();
    expect(wg.contentDOM.querySelectorAll(".wg-selected-cell").length).toBe(5);
    expect(wg.contentDOM.querySelector("th.wg-selected-cell")?.getAttribute("id")).toBe("h1");
    expect(sorted(wg)).toEqual(sorted(create({ state: wg.state })));
    wg.dispatch({ selection: { anchor: wg.state.doc.length - 1 } });
    wg.flush();
    expect(wg.contentDOM.querySelectorAll(".wg-selected-cell").length).toBe(0);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("draws nested tables", () => {
    const wg = create({
      doc:
        '<table><tbody><tr><td data-colwidth="200"><p>out</p>' +
        '<table><tbody><tr><td data-header="true" data-colwidth="80"><p>in</p></td></tr></tbody></table>' +
        "<p></p></td></tr></tbody></table>",
    });
    expect(
      wg.contentDOM.querySelector("td .cellContent > .tableWrapper > table th p")?.textContent
    ).toBe("in");
    typeInto(wg, textIn(wg, "th .cellContent p"), 2, "x");
    wg.flush();
    expect(wg.state.doc.textContent({ blockSeparator: "|" })).toContain("inx");
    expect(drawn(wg)).toEqual(fresh(wg));
  });
});
