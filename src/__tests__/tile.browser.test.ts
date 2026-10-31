// R1's "done when": React's tree draws the same DOM as Wordgard's own renderer
// and answers the tile queries the same way.
import { Node as DocNode, Elt, Leaf, Mark, Plot } from "wordgard/doc";
import { Decoration, Widget, Wordgard } from "wordgard/editor";
import {
  alignment,
  blockDoc,
  blockquote,
  bulletList,
  heading,
  horizontalRule,
  inlineMarks,
  lineBreak,
  orderedList,
  paragraph,
} from "wordgard/schema";
import { GardState, Transaction } from "wordgard/state";
import {
  Blockquote,
  CaptionedFigure,
  Cell,
  ColSpan,
  Color,
  Emphasis,
  Figure,
  HeaderCell,
  HorizontalRule,
  Image,
  LineBreak,
  Paragraph,
  RowSpan,
  Strong,
  Table,
  TableRow,
} from "wordgard/types";

import { ReactWordgard } from "../ReactWordgard.js";
import { ReactDocTile } from "../tile.js";
import { DocTile, type Tile, TileFlag } from "../wordgardInternals.js";

// A fixed-size image (see the style below), so layout doesn't wait on loading.
const img = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

const docs = {
  "a paragraph": "<p>hello</p>",
  "an empty paragraph": "<p></p>",
  "several paragraphs": "<p>one</p><p></p><p>three</p>",
  "wrapped lines": `<p>${"Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(4)}</p>`,
  "bidi text": "<p>abc אבג דהו def</p><p>אבג abc</p>",
  "nested plots": "<h2>Title</h2><blockquote><p>quoted</p><p></p></blockquote><p>after</p>",
  "marks on text":
    "<p>plain <em>em <strong>both</strong></em><strong> strong</strong> <code>code</code></p>",
  "marks of different ranks":
    "<p><strong>ab<em>cd</em>ef</strong> <em>gh<strong>ij</strong>kl</em></p>",
  links:
    '<p><a href="https://a.example">a link <em>in em</em></a> and <a href="https://b.example">another</a></p>',
  "attribute marks":
    '<p><span style="color: red">red <span style="background-color: yellow">on yellow</span></span> plain</p>',
  "attribute and element marks":
    '<p><u style="color: blue">under<strong>lined</strong></u><s> struck</s></p>',
  "marks on blocks":
    '<p style="text-align: center">centered <em>text</em></p><h2 style="text-align: end">Title</h2>',
  "line breaks": "<p>one<br>two</p><p>ends in a break<br></p><p><em>a<br></em></p>",
  images: `<p>an <img src="${img}"> image</p><p><img src="${img}"></p><p><strong>a<img src="${img}">b</strong></p>`,
  "a rule": "<p>above</p><hr><p>below</p>",
  lists: "<ul><li><p>one</p></li><li><p>two</p><ol><li><p>nested</p></li></ol></li></ul>",
  "a table":
    "<table><tbody><tr><th>head</th><th></th></tr><tr><td>a <em>b</em></td><td>c</td></tr></tbody></table>",
  figures: `<figure><img src="${img}"></figure><figure><img src="${img}"><figcaption>a <em>caption</em></figcaption></figure>`,
  "inline plots":
    '<p>a <span class="chip">chip <em>b</em></span> c</p><p><span class="chip"></span></p>',
  // Wordgard's trailing-<br> scan skips the structure around such a plot's content.
  "inline plots with nested content":
    '<p><span class="nested"><span class="in">x</span></span></p><p>a<br><span class="nested"><span class="in">y</span></span></p>',
  "inline atoms":
    '<p>a<span class="atom">x</span>b</p><p><strong>a<span class="atom">x</span>b</strong></p><p><span class="atom">x</span></p>',
  "shape attributes":
    '<p>a<span class="marker"></span>b</p><table><tbody><tr><td colspan="2" rowspan="2">wide</td></tr></tbody></table>',
};

// An inline plot, which Wordgard draws between two `wg-buffer` images.
const Chip = Plot.define("Chip", {
  inline: true,
  inlineContent: true,
  shape: { element: "span", attributes: { class: "chip" } },
  parseRules: [{ selector: "span.chip" }],
});

const Nested = Plot.define("Nested", {
  inline: true,
  inlineContent: true,
  shape: {
    structure: Elt.mk("span", { class: "nested" }, [Elt.mk("span", { class: "in" }, [0])]),
    atom: false,
  },
  parseRules: [{ selector: "span.nested", contentElement: "span.in", precedence: 10 }],
});

// Wordgard 0.6.2 draws a stray buffer after an inline atom, which React mirrors
// (docs/wordgard-upstream-bugs.md).
const InlineAtom = Plot.define("InlineAtom", {
  inline: true,
  inlineContent: true,
  shape: { structure: Elt.mk("span", { class: "atom" }), atom: true },
  parseRules: [{ selector: "span.atom", precedence: 10 }],
});

// A spanning mark inline plots can take, to wrap an atom and its buffer.
const Highlight = Mark.define("Highlight", {
  shape: { element: "mark" },
  target: DocNode.Group.Inline,
});

// Attributes React would get wrong through its own props handling.
const Marker = Leaf.define("Marker", {
  inline: true,
  shape: { element: "span", attributes: { class: "marker", draggable: "false", hidden: "" } },
  parseRules: [{ selector: "span.marker", precedence: 10 }],
});

// Widgets, drawn as spans (or a text node), editable, out of the flow or not.
const label = (text: string) =>
  Object.assign(document.createElement("span"), { className: "w", textContent: text });
const Label = Widget.define<string>({ render: label });
const EditableLabel = Widget.define<string>({ render: label, editable: true });
const Aside = Widget.define<string>({ render: label, inFlow: false });
const TextWidget = Widget.define<string>({ render: (text) => document.createTextNode(text) });

// Decorations of every kind, each in a document of its own.
const pointAt = (...decos: [Decoration.Point, number][]) =>
  Decoration.Point.source.of(() => Decoration.Point.set(decos));
const rangeOver = (...decos: [Decoration.Range, number, number][]) =>
  Decoration.Range.source.of(() => Decoration.Range.set(decos));
const decorated: Record<string, [string, GardState.Extension]> = {
  "tag attributes and wrappers": [
    "<p>one</p><h2>two</h2><p>three</p>",
    [
      Decoration.Tag.attribute(Paragraph, "data-p", "x"),
      Decoration.Tag.wrapper(Paragraph, Elt.mk("div", { class: "pwrap" }, [0])),
    ],
  ],
  "tag shapes": [
    `<p>a<img src="${img}">b</p>`,
    Decoration.Tag.shape(Image, Elt.mk("span", { class: "img" }, [Elt.mk("i", ["!"])])),
  ],
  "mark shape overrides": [
    "<p>a<strong>bc</strong>d</p>",
    Decoration.Mark.shape(Strong, { element: "b" }),
  ],
  "point decorations": [
    `<p>one</p><p>two<img src="${img}"></p><p>three</p>`,
    pointAt(
      [Decoration.Point.attributes({ class: "hl" }), 0],
      [Decoration.Point.wrapper(Elt.mk("section", [0])), 5],
      [Decoration.Point.shape(Elt.mk("span", { class: "shaped" })), 9]
    ),
  ],
  // A set whose second layer holds overlapping ranges (docs/wordgard-upstream-bugs.md).
  "overlapping ranges": [
    "<p>one</p><p>two</p><p>three</p><p>four</p>",
    rangeOver(
      [Decoration.Range.attribute("data-a", "1"), 1, 3],
      [Decoration.Range.wrapper("mark", {}), 2, 20],
      [Decoration.Range.attribute("data-b", "1"), 6, 8],
      [Decoration.Range.attribute("data-c", "1"), 12, 14],
      [Decoration.Range.attribute("data-d", "1"), 13, 15]
    ),
  ],
  "range decorations": [
    "<p>one two three</p><p>four</p>",
    rangeOver(
      [Decoration.Range.wrapper("mark", { attributes: { class: "r" } }), 2, 8],
      [Decoration.Range.attribute("data-r", "1", { scope: "all" }), 7, 16]
    ),
  ],
  "tag widgets": [
    "<p>one</p><h2>two</h2><p></p>",
    [
      Decoration.Tag.widget(Paragraph, "before", Label.of("b")),
      Decoration.Tag.widget(Paragraph, "after", EditableLabel.of("a")),
      Decoration.Tag.widget(Paragraph, "start", TextWidget.of("s")),
      Decoration.Tag.widget(Paragraph, "end", Label.of("e")),
    ],
  ],
  "point widgets": [
    "<p>abcd</p><p>ef</p>",
    pointAt(
      [Decoration.Point.widget(Label.of("E")), 1],
      [Decoration.Point.widget(Label.of("A"), { side: -1 }), 3],
      [Decoration.Point.widget(Label.of("B"), { side: 0 }), 3],
      [Decoration.Point.widget(Label.of("C"), { side: 1 }), 3],
      [Decoration.Point.widget(Label.of("D")), 6],
      [Decoration.Point.widget(Label.of("F")), 10]
    ),
  ],
  // As in Wordgard's test "picks the right side of widgets on wrapper boundaries".
  "widgets on wrapper boundaries": [
    "<p><strong>a</strong>b<strong>c</strong>d</p>",
    pointAt(
      [Decoration.Point.widget(Label.of("A"), { side: -1 }), 1],
      [Decoration.Point.widget(Label.of("B"), { side: 1 }), 2],
      [Decoration.Point.widget(Label.of("C"), { side: 1 }), 3],
      [Decoration.Point.widget(Label.of("D"), { side: -1 }), 4]
    ),
  ],
  // The empty paragraph still gets its <br>; the other doesn't.
  "widgets out of the flow": [
    "<p>ab</p><p></p>",
    pointAt(
      [Decoration.Point.widget(Aside.of("x")), 3],
      [Decoration.Point.widget(Aside.of("y")), 5]
    ),
  ],
  "widget shapes": [
    `<p>a<img src="${img}">b</p><hr>`,
    [
      Decoration.Tag.shape(Image, (tag) => Label.of(tag.param.slice(-4))),
      Decoration.Tag.shape(HorizontalRule, EditableLabel.of("rule")),
    ],
  ],
  "widgets inside shapes": [
    `<p>a<img src="${img}">b</p><blockquote><p>q</p></blockquote>`,
    [
      Decoration.Tag.shape(Image, Elt.mk<Widget>("span", { class: "img" }, [Label.of("i")])),
      Decoration.Tag.shape(
        Blockquote,
        Elt.mk<Widget>("blockquote", [Label.of("quote"), Elt.mk("div", [0])])
      ),
    ],
  ],
};

const cases: [string, string, GardState.Extension][] = [
  ...Object.entries(docs).map(([name, doc]): [string, string, GardState.Extension] => [
    name,
    doc,
    [],
  ]),
  ...Object.entries(decorated).map(
    ([name, [doc, extra]]): [string, string, GardState.Extension] => [
      `${name} (decorated)`,
      doc,
      extra,
    ]
  ),
];

// Schema parts only: their extensions can add decorations (image resizing,
// table cell selection), which React doesn't draw yet.
const config = [
  blockDoc(),
  paragraph(),
  heading(),
  blockquote(),
  bulletList(),
  orderedList(),
  horizontalRule(),
  lineBreak(),
  inlineMarks(),
  alignment(),
  GardState.schemaElement.of([
    Image,
    Figure,
    CaptionedFigure,
    Table,
    TableRow,
    Cell,
    HeaderCell,
    ColSpan,
    RowSpan,
    Chip,
    Nested,
    InlineAtom,
    Highlight,
    Marker,
  ]),
];

type Create = (spec: Wordgard.Spec) => Wordgard;

const imageSize = document.createElement("style");
imageSize.textContent = "img[src] { width: 20px; height: 20px; }";
document.head.appendChild(imageSize);

const mount = (create: Create, doc: Wordgard.Spec["doc"], extra: GardState.Extension = []) => {
  const parent = document.createElement("div");
  parent.style.cssText = "position: absolute; left: 0; top: 0; width: 300px;";
  document.body.appendChild(parent);
  const wg = create({ doc, config: [config, extra], parent });
  wg.flush();
  return wg;
};

const docTileOf = (wg: Wordgard) => {
  const tile = wg.contentDOM.wgTile;
  if (!(tile instanceof DocTile)) throw new Error("No DocTile");
  return tile;
};

const pathOf = (root: Node, node: Node) => {
  const path: number[] = [];
  for (let cur = node; cur != root;) {
    const parent = cur.parentNode;
    if (!parent) throw new Error("Node outside the content");
    path.unshift([...parent.childNodes].findIndex((child) => child == cur));
    cur = parent;
  }
  return path;
};

const nodeAt = (root: Node, path: readonly number[]) =>
  path.reduce<Node>((node, i) => {
    const child = node.childNodes[i];
    if (!child) throw new Error("No node at path");
    return child;
  }, root);

const blockIn = (content: HTMLElement, index: number) => {
  const block = content.children[index];
  if (!block) throw new Error("No block");
  return block;
};

const firstText = (node: Node | null) => {
  const text = node?.firstChild;
  if (!(text instanceof Text)) throw new Error("No text node");
  return text;
};

const textIn = (content: HTMLElement, index: number) => firstText(blockIn(content, index));

const describeTile = (tile: Tile, root: Node): unknown => ({
  kind: tile.isDoc ? "doc" : Object.getPrototypeOf(tile).constructor.name,
  flags: tile.flags,
  length: tile.length,
  dom: pathOf(root, tile.dom),
  children: tile.children.map((child) => describeTile(child, root)),
});

const allDOMPoints = (root: Node) => {
  const points: { path: number[]; offset: number }[] = [];
  const walk = (node: Node) => {
    const size = node.nodeType == 3 ? (node.nodeValue ?? "").length : node.childNodes.length;
    for (let offset = 0; offset <= size; offset++)
      points.push({ path: pathOf(root, node), offset });
    node.childNodes.forEach(walk);
  };
  walk(root);
  return points;
};

describe("ReactDocTile", () => {
  let editors: Wordgard[] = [];
  afterEach(() => {
    for (const wg of editors) wg.dom.parentElement?.remove();
    editors = [];
  });

  const both = (doc: Wordgard.Spec["doc"], extra: GardState.Extension = []) => {
    const wordgard = mount(Wordgard.create, doc, extra);
    const react = mount(ReactWordgard.create, doc, extra);
    editors.push(wordgard, react);
    return { wordgard, react };
  };

  // posAtCoords hit-tests the page, so each editor is measured on its own.
  const alone = <T>(
    create: Create,
    doc: string,
    f: (wg: Wordgard) => T,
    extra: GardState.Extension = []
  ) => {
    const wg = mount(create, doc, extra);
    try {
      return f(wg);
    } finally {
      wg.dom.parentElement?.remove();
    }
  };

  for (const [name, doc, extra] of cases) {
    describe(`on ${name}`, () => {
      it("renders through React", () => {
        const { react } = both(doc, extra);
        expect(react.contentDOM.wgTile).toBeInstanceOf(ReactDocTile);
      });

      it("draws the same DOM and tile tree", () => {
        const { wordgard, react } = both(doc, extra);
        expect(react.contentDOM.innerHTML).toBe(wordgard.contentDOM.innerHTML);
        expect(describeTile(docTileOf(react), react.contentDOM)).toEqual(
          describeTile(docTileOf(wordgard), wordgard.contentDOM)
        );
      });

      it("resolves positions and finds node tiles the same way", () => {
        const { wordgard, react } = both(doc, extra);
        const answers = (wg: Wordgard) => {
          const tile = docTileOf(wg);
          const result = [];
          for (let pos = 0; pos <= wg.state.doc.length; pos++) {
            for (const side of [-1, 1] as const) {
              const found = tile.resolve(pos, side);
              result.push([pos, side, pathOf(wg.contentDOM, found.tile.dom), found.offset]);
            }
            const node = tile.nodeTile(pos);
            result.push([pos, node && pathOf(wg.contentDOM, node.dom)]);
          }
          return result;
        };
        expect(answers(react)).toEqual(answers(wordgard));
      });

      it("maps DOM positions the same way", () => {
        const { wordgard, react } = both(doc, extra);
        const answers = (wg: Wordgard) =>
          allDOMPoints(wg.contentDOM).flatMap(({ path, offset }) =>
            ([-1, 1] as const).map((bias) =>
              docTileOf(wg).posFromDOM(nodeAt(wg.contentDOM, path), offset, bias)
            )
          );
        expect(answers(react)).toEqual(answers(wordgard));
      });

      it("maps coordinates the same way", () => {
        const answers = (wg: Wordgard) => {
          const { left, top, width, height } = wg.contentDOM.getBoundingClientRect();
          const result = [];
          for (let y = top - 4; y < top + height + 4; y += 3)
            for (let x = left - 4; x < left + width + 4; x += 5)
              result.push(wg.posAtCoords({ x, y }));
          for (let pos = 0; pos <= wg.state.doc.length; pos++)
            for (const side of [-1, 1] as const) result.push(wg.coordsAtPos(pos, side).toJSON());
          return result;
        };
        expect(alone(ReactWordgard.create, doc, answers, extra)).toEqual(
          alone(Wordgard.create, doc, answers, extra)
        );
      });
    });
  }

  it("draws the decorations it's given", () => {
    const html = (name: string) => {
      const found = decorated[name];
      if (!found) throw new Error(`No document ${name}`);
      return both(...found).react.contentDOM.innerHTML;
    };
    expect(html("tag attributes and wrappers")).toContain('<div class="pwrap" data-p="x"><p>');
    expect(html("tag shapes")).toContain('<span class="img" contenteditable="false"><i>!</i>');
    expect(html("mark shape overrides")).toContain("<b>bc</b>");
    const points = html("point decorations");
    for (const part of ['<p class="hl">', "<section><p>", 'class="shaped"'])
      expect(points).toContain(part);
    const ranges = html("range decorations");
    for (const part of ['<mark class="r">', 'data-r="1"']) expect(ranges).toContain(part);
  });

  // A plot object can appear more than once; each copy is laid out where it is.
  it("lays out each copy of a shared plot on its own", () => {
    const shared = Paragraph.create([Leaf.text("one")]);
    const { wordgard, react } = both((schema) =>
      schema.doc([shared, Paragraph.create([Leaf.text("two")]), shared])
    );
    for (const wg of [wordgard, react]) {
      wg.dispatch({
        effects: GardState.appendConfig.of(rangeOver([Decoration.Range.wrapper("mark", {}), 1, 3])),
      });
      wg.flush();
    }
    expect(react.contentDOM.innerHTML).toBe("<p><mark>on</mark>e</p><p>two</p><p>one</p>");
    expect(react.contentDOM.innerHTML).toBe(wordgard.contentDOM.innerHTML);
  });

  it("redraws when only the decorations change", () => {
    const { wordgard, react } = both("<p>one two</p><p>three</p>");
    const before = react.contentDOM.innerHTML;
    for (const wg of [wordgard, react]) {
      wg.dispatch({
        effects: GardState.appendConfig.of([
          rangeOver([Decoration.Range.wrapper("mark", {}), 2, 6]),
          pointAt([Decoration.Point.attributes({ class: "hl" }), 9]),
        ]),
      });
      wg.flush();
    }
    expect(react.contentDOM.innerHTML).not.toBe(before);
    expect(react.contentDOM.innerHTML).toBe(wordgard.contentDOM.innerHTML);
    expect(describeTile(docTileOf(react), react.contentDOM)).toEqual(
      describeTile(docTileOf(wordgard), wordgard.contentDOM)
    );
  });

  it("keeps matching Wordgard's DOM through edits", () => {
    const { wordgard, react } = both(docs["several paragraphs"]);
    const edits = [
      { changes: { from: 1, insert: [Leaf.text("Hi, ")] } },
      { changes: { from: 9, to: 11 } },
      { changes: { from: 0, to: 9 } },
      { changes: { from: 2, insert: [Leaf.text("x")] } },
      { changes: { from: 2, insert: [Leaf.text("bold", [Strong])] } },
      { changes: { from: 4, to: 7, insert: [Leaf.text("em", [Emphasis, Strong])] } },
      { changes: { from: 1, insert: [Leaf.text("red", [Color.of("red")])] } },
      { changes: { from: 3, to: 6 } },
      { changes: { from: 2, insert: [LineBreak] } },
      { changes: { from: 1, insert: [Image.of(img, [Strong])] } },
      { changes: { from: 1, to: 2 } },
      { changes: { from: 2, to: 3 } },
    ];
    for (const spec of edits) {
      for (const wg of [wordgard, react]) {
        wg.dispatch(spec);
        wg.flush();
      }
      expect(react.contentDOM.innerHTML).toBe(wordgard.contentDOM.innerHTML);
      expect(describeTile(docTileOf(react), react.contentDOM)).toEqual(
        describeTile(docTileOf(wordgard), wordgard.contentDOM)
      );
    }
  });

  describe("through edits", () => {
    const edit = (wg: Wordgard, changes: Transaction.Spec["changes"]) => {
      wg.dispatch({ changes });
      wg.flush();
    };

    it("keeps a paragraph's element and text node when typing in it", () => {
      const { react } = both("<p>abc</p><p>def</p>");
      const p = blockIn(react.contentDOM, 0);
      const text = textIn(react.contentDOM, 0);
      edit(react, { from: 1, insert: [Leaf.text("x")] });
      edit(react, { from: 3, insert: [Leaf.text("y")] });
      expect(blockIn(react.contentDOM, 0)).toBe(p);
      expect(textIn(react.contentDOM, 0)).toBe(text);
      expect(text.nodeValue).toBe("xaybc");
    });

    it("keeps the other paragraphs' elements when one is inserted or deleted", () => {
      const { react } = both("<p>a</p><p>b</p><p>c</p>");
      const [a, b, c] = react.contentDOM.children;
      edit(react, { from: 0, insert: [Paragraph.create([Leaf.text("new")])] });
      expect([...react.contentDOM.children].slice(1)).toEqual([a, b, c]);
      edit(react, { from: 8, to: 11 });
      expect([...react.contentDOM.children].slice(1)).toEqual([a, c]);
      expect(a?.textContent).toBe("a");
    });

    it("keeps the tiles of nodes an edit didn't touch", () => {
      const { react } = both(`<p>a</p><p>b<img src="${img}"></p>`);
      const kept = blockIn(react.contentDOM, 1).wgTile;
      const touched = blockIn(react.contentDOM, 0).wgTile;
      edit(react, { from: 1, insert: [Leaf.text("x")] });
      expect(blockIn(react.contentDOM, 1).wgTile).toBe(kept);
      expect(blockIn(react.contentDOM, 0).wgTile).not.toBe(touched);
      expect(kept?.parent).toBe(docTileOf(react));
    });
  });

  // Emulates an IME, adapted from Wordgard's `compose` test helper
  // (test/wordgard/webtest-composition.ts): each step edits a text node (the
  // one at `from`, or one `start` makes) and fires the events, or runs an edit
  // of the editor's own.
  type CompositionStep =
    { from: number; to: number; text: string } | { run: (wg: Wordgard) => void };
  const compositions: Record<
    string,
    { doc: string; steps: CompositionStep[]; start?: (content: HTMLElement) => Text }
  > = {
    "inside text": {
      doc: "<p>ab</p>",
      steps: [
        { from: 2, to: 2, text: "-" },
        { from: 2, to: 3, text: "*" },
      ],
    },
    "inside a mark": {
      doc: "<p>a<strong>bc</strong>d</p>",
      steps: [
        { from: 3, to: 3, text: "-" },
        { from: 4, to: 4, text: "$" },
      ],
    },
    "in a new node at the end of a block": {
      doc: "<p>foo</p>",
      start: (content) => blockIn(content, 0).appendChild(document.createTextNode("")),
      steps: [
        { from: 4, to: 4, text: "!" },
        { from: 5, to: 5, text: "?" },
      ],
    },
    "on an empty line": {
      doc: "<p>.</p><p></p>",
      start: (content) => blockIn(content, 1).appendChild(document.createTextNode("")),
      steps: [
        { from: 4, to: 4, text: "a" },
        { from: 5, to: 5, text: "b" },
      ],
    },
    "with an insertion before its wrapper": {
      doc: "<p><strong>bc</strong>d</p>",
      steps: [
        { from: 2, to: 2, text: "-" },
        { run: (wg) => wg.dispatch({ changes: { from: 1, insert: [Leaf.text("x")] } }) },
        { from: 4, to: 4, text: "$" },
      ],
    },
    "in an element the browser added": {
      doc: "<p>foo</p>",
      start: (content) => {
        const span = document.createElement("span");
        span.style.fontWeight = "bold";
        blockIn(content, 0).appendChild(span);
        return span.appendChild(document.createTextNode(""));
      },
      steps: [
        { from: 4, to: 4, text: "!" },
        { from: 5, to: 5, text: "?" },
      ],
    },
  };

  for (const [name, { doc, steps, start }] of Object.entries(compositions)) {
    it(`keeps the composition's node and matches Wordgard: ${name}`, () => {
      const run = (wg: Wordgard) => {
        wg.focus();
        const sel = document.getSelection();
        const fire = (event: Event) => wg.contentDOM.dispatchEvent(event);
        const states = [];
        let node = start?.(wg.contentDOM) ?? null;
        fire(new CompositionEvent("compositionstart"));
        const settle = (node: Text) => {
          const parents = [];
          for (let p = node.parentNode; p && p != wg.contentDOM; p = p.parentNode) parents.push(p);
          const offset = sel?.focusOffset;
          wg.flush();
          const kept = [];
          for (let p = node.parentNode; p && p != wg.contentDOM; p = p.parentNode) kept.push(p);
          expect(kept).toEqual(parents);
          expect(sel?.focusNode).toBe(node);
          expect(sel?.focusOffset).toBe(offset);
          states.push({
            html: wg.contentDOM.innerHTML,
            tiles: describeTile(docTileOf(wg), wg.contentDOM),
          });
        };
        for (const step of steps) {
          if ("run" in step) {
            step.run(wg);
            if (!node) throw new Error("No composition to keep");
            settle(node);
            continue;
          }
          const { from, to, text } = step;
          fire(new CompositionEvent("compositionupdate"));
          const at = wg.domAtPos(from, -1);
          if (!node) {
            if (!(at.node instanceof Text)) throw new Error("No text node to compose in");
            node = at.node;
          }
          const offset = at.node == node ? at.offset : (node.nodeValue ?? "").length;
          const range = new StaticRange({
            startContainer: node,
            startOffset: offset,
            endContainer: node,
            endOffset: offset + to - from,
          });
          const init = { inputType: "insertCompositionText", data: text, isComposing: true };
          fire(new InputEvent("beforeinput", { ...init, targetRanges: [range] }));
          node.replaceData(offset, to - from, text);
          sel?.collapse(node, offset + text.length);
          fire(new InputEvent("input", init));
          settle(node);
        }
        fire(new CompositionEvent("compositionend"));
        wg.flush();
        // Wordgard's update keeps the composed node's tile, flag included, where
        // React's view builds a new one.
        const settled = JSON.stringify(describeTile(docTileOf(wg), wg.contentDOM)).replace(
          /"flags":(\d+)/g,
          (_, flags) => `"flags":${Number(flags) & ~TileFlag.Composition}`
        );
        states.push({ doc: String(wg.state.doc), html: wg.contentDOM.innerHTML, tiles: settled });
        return states;
      };
      const expected = alone(Wordgard.create, doc, run);
      expect(JSON.stringify(expected)).toContain(
        `"flags":${TileFlag.Composition | TileFlag.Synced}`
      );
      expect(alone(ReactWordgard.create, doc, run)).toEqual(expected);
    });
  }

  // Wordgard lets the browser do these edits and records them; the flush then
  // has to bring React's DOM back in line.
  const nativeEdits = {
    "typing inside text": {
      doc: "<p>hello</p>",
      inputType: "insertText",
      data: "X",
      edit: (content: HTMLElement) => {
        const text = textIn(content, 0);
        return { range: [text, 2, text, 2], mutate: () => text.insertData(2, "X") } as const;
      },
    },
    "typing into an empty paragraph": {
      doc: "<p>one</p><p></p>",
      inputType: "insertText",
      data: "a",
      edit: (content: HTMLElement) => {
        const p = blockIn(content, 1);
        return {
          range: [p, 0, p, 0],
          mutate: () => p.replaceChildren(document.createTextNode("a")),
        } as const;
      },
    },
    "deleting inside text": {
      doc: "<p>hello</p>",
      inputType: "deleteContentBackward",
      data: null,
      edit: (content: HTMLElement) => {
        const text = textIn(content, 0);
        return { range: [text, 1, text, 3], mutate: () => text.deleteData(1, 2) } as const;
      },
    },
    "typing inside a mark": {
      doc: "<p><strong>bold</strong> text</p>",
      inputType: "insertText",
      data: "X",
      edit: (content: HTMLElement) => {
        const text = firstText(content.querySelector("strong"));
        return { range: [text, 2, text, 2], mutate: () => text.insertData(2, "X") } as const;
      },
    },
    "deleting a paragraph's last character": {
      doc: "<p>a</p><p>b</p>",
      inputType: "deleteContentBackward",
      data: null,
      edit: (content: HTMLElement) => {
        const text = textIn(content, 0);
        return {
          range: [text, 0, text, 1],
          mutate: () => blockIn(content, 0).replaceChildren(document.createElement("br")),
        } as const;
      },
    },
  };

  for (const [name, { doc, inputType, data, edit }] of Object.entries(nativeEdits)) {
    it(`follows the browser's own edit: ${name}`, () => {
      const run = (wg: Wordgard) => {
        wg.focus();
        const {
          range: [startContainer, startOffset, endContainer, endOffset],
          mutate,
        } = edit(wg.contentDOM);
        const range = new StaticRange({ startContainer, startOffset, endContainer, endOffset });
        document
          .getSelection()
          ?.setBaseAndExtent(startContainer, startOffset, endContainer, endOffset);
        wg.contentDOM.dispatchEvent(
          new InputEvent("beforeinput", { inputType, data, targetRanges: [range] })
        );
        mutate();
        wg.contentDOM.dispatchEvent(new InputEvent("input", { inputType, data }));
        wg.flush();
        return {
          doc: String(wg.state.doc),
          html: wg.contentDOM.innerHTML,
          tiles: describeTile(docTileOf(wg), wg.contentDOM),
        };
      };
      const before = alone(Wordgard.create, doc, (wg) => String(wg.state.doc));
      const expected = alone(Wordgard.create, doc, run);
      expect(expected.doc).not.toBe(before);
      expect(alone(ReactWordgard.create, doc, run)).toEqual(expected);
    });
  }

  it("draws a textblock holding only an empty text leaf as an empty one", () => {
    const { react } = both("<p>ab</p>");
    react.dispatch({ changes: { from: 1, to: 3, insert: [Leaf.text("")] } });
    react.flush();
    const [p] = react.state.doc.content;
    expect(p?.isPlot && p.content.length).toBe(1);
    expect(react.contentDOM.innerHTML).toBe("<p><br></p>");
    expect(docTileOf(react).resolve(1, 1).tile.dom.nodeName).toBe("P");
  });

  it("draws the marks and nodes it's given", () => {
    const html = (doc: string) => both(doc).react.contentDOM.innerHTML;
    expect(html(docs["marks of different ranks"])).toContain("<em><strong>cd</strong></em>");
    expect(html(docs["attribute marks"])).toContain(
      '<span style="color: red;background-color: yellow">'
    );
    expect(html(docs["marks on blocks"])).toContain('<p style="text-align: center">');
    expect(html(docs["line breaks"])).toContain("<p>ends in a break<br><br></p>");
    expect(html(docs["a rule"])).toContain("<hr>");
    expect(html(docs["a table"])).toContain("<table><tbody><tr><th>head</th>");
    expect(html(docs.figures)).toContain("<figcaption>a <em>caption</em></figcaption>");
    expect(html(docs["inline plots with nested content"])).toContain("</span></span><br></p>");
    expect(html(docs["inline atoms"])).toContain(
      '<p>a<span class="atom" contenteditable="false"></span><img class="wg-buffer">b</p>'
    );
    expect(html(docs["shape attributes"])).toContain('draggable="false" hidden=""');
    expect(html(docs["shape attributes"])).toContain('<td colspan="2" rowspan="2">');
    expect(html(docs["inline plots"])).toContain(
      '<span class="chip"><img class="wg-buffer">chip <em>b</em><img class="wg-buffer"></span>'
    );
  });

  // Wordgard 0.6.2 leaves the point in the parent too, so its sync moves the
  // buffer after the wrapper (docs/wordgard-upstream-bugs.md). React keeps it
  // inside, as Wordgard intends.
  it("moves the points a spanning wrapper continues over into it", () => {
    const { react } = both('<p><mark>a<span class="atom">x</span>b</mark></p>');
    expect(react.contentDOM.innerHTML).toBe(
      '<p><mark>a<span class="atom" contenteditable="false"></span><img class="wg-buffer">b</mark></p>'
    );
    const buffer = react.contentDOM.querySelector("img.wg-buffer");
    expect(buffer?.wgTile?.parent?.dom).toBe(react.contentDOM.querySelector("mark"));
    const widget = both(
      "<p><strong>ab</strong></p>",
      pointAt([Decoration.Point.widget(Label.of("w")), 2])
    ).react.contentDOM;
    expect(widget.innerHTML).toBe(
      '<p><strong>a<span class="w" contenteditable="false">w</span>b</strong></p>'
    );
    expect(widget.querySelector(".w")?.wgTile?.parent?.dom).toBe(widget.querySelector("strong"));
  });

  describe("with widgets", () => {
    const edit = (wg: Wordgard, changes: Transaction.Spec["changes"]) => {
      wg.dispatch({ changes });
      wg.flush();
    };
    const flip = Transaction.Effect.define<null>();
    // Point widgets that follow the edits, and change on `flip`.
    const points = GardState.Field.define({
      create: () =>
        Decoration.Point.set([
          [Decoration.Point.widget(Label.of("x")), 2],
          [Decoration.Point.widget(EditableLabel.of("y"), { side: -1 }), 7],
        ]),
      update: (set: Decoration.Point.Set, tr: Transaction) =>
        tr.effects.some((effect) => effect.is(flip))
          ? Decoration.Point.set([[Decoration.Point.widget(Label.of("z")), 2]])
          : set.map(tr.changes),
      provide: (field) => Decoration.Point.source.of((state) => state.field(field)),
    });
    const widgets = [
      points,
      Decoration.Tag.widget(Image, "before", Label.of("<")),
      Decoration.Tag.widget(Image, "after", Label.of(">")),
      Decoration.Tag.widget(Paragraph, "start", Label.of("|")),
    ];
    const doc = `<p>ab<img src="${img}">cd</p><p>ef</p>`;
    const steps: Transaction.Spec[] = [
      { changes: { from: 1, insert: [Leaf.text("x")] } },
      { changes: { from: 0, insert: [Paragraph.create([Leaf.text("new")])] } },
      { changes: { from: 9, to: 10, insert: [Image.of(`${img}#2`)] } },
      // Marks next to widgets, not across them (Wordgard bug 2).
      { changes: { from: 6, to: 8, add: Strong } },
      { changes: { from: 6, to: 8, remove: Strong, add: Emphasis } },
      { effects: flip.of(null) },
      { changes: { from: 16, insert: [Leaf.text("g")] } },
      { changes: { from: 0, to: 5 } },
      { changes: { from: 2, to: 6 } },
    ];

    it("keeps matching Wordgard's DOM, and reuses the same widget nodes", () => {
      const { wordgard, react } = both(doc, widgets);
      for (const spec of steps) {
        const reuse = (wg: Wordgard) => {
          const before = [...wg.contentDOM.querySelectorAll(".w")];
          wg.dispatch(spec);
          wg.flush();
          return [...wg.contentDOM.querySelectorAll(".w")].map((w) => before.includes(w));
        };
        expect(reuse(react)).toEqual(reuse(wordgard));
        expect(react.contentDOM.innerHTML).toBe(wordgard.contentDOM.innerHTML);
        expect(describeTile(docTileOf(react), react.contentDOM)).toEqual(
          describeTile(docTileOf(wordgard), wordgard.contentDOM)
        );
      }
    });

    it("keeps a widget's node when typing next to it", () => {
      const { react } = both(doc, widgets);
      const [x] = react.contentDOM.querySelectorAll(".w");
      edit(react, { from: 1, insert: [Leaf.text("x")] });
      edit(react, { from: 4, insert: [Leaf.text("y")] });
      expect(react.contentDOM.querySelectorAll(".w")[0]).toBe(x);
      expect(x?.textContent).toBe("|");
      const y = react.contentDOM.querySelectorAll(".w")[1];
      edit(react, { from: 2, insert: [Leaf.text("z")] });
      expect(react.contentDOM.querySelectorAll(".w")[1]).toBe(y);
    });

    it("connects and disconnects widgets as Wordgard does", () => {
      const run = (create: Create) => {
        const log: string[] = [];
        const Tracked = Widget.define<string>({
          render: label,
          connect: (value) => log.push(`connect ${value}`),
          disconnect: (value) => log.push(`disconnect ${value}`),
        });
        const wg = mount(create, `<p>a<img src="${img}">b</p>`, [
          Decoration.Tag.shape(Image, (tag) => Tracked.of(tag.param.slice(-2))),
          Decoration.Tag.widget(Paragraph, "end", Tracked.of("end")),
          Decoration.Tag.shape(
            Blockquote,
            Elt.mk<Widget>("blockquote", [Tracked.of("quote"), Elt.mk("div", [0])])
          ),
        ]);
        // ReactWordgard's constructor draws the document twice.
        log.length = 0;
        const step = (spec: Transaction.Spec) => {
          wg.dispatch(spec);
          wg.flush();
          log.push("|");
        };
        step({ changes: { from: 2, to: 3, insert: [Image.of(`${img}#2`)] } });
        step({ changes: { from: 1, insert: [Leaf.text("x")] } });
        const quote = Blockquote.create([Paragraph.create([Leaf.text("q"), Image.of(`${img}#3`)])]);
        step({ changes: { from: wg.state.doc.length, insert: [quote] } });
        step({ changes: { from: wg.state.doc.length - 2, insert: [Leaf.text("r")] } });
        // Redrawn without changing: a range wrapper, then a new tag widget (all redrawn).
        const mark = rangeOver([Decoration.Range.wrapper("mark", {}), 1, 6]);
        step({ effects: GardState.appendConfig.of(mark) });
        const start = Decoration.Tag.widget(Paragraph, "start", Tracked.of("s"));
        step({ effects: GardState.appendConfig.of(start) });
        step({ changes: { from: 0, to: wg.state.doc.length, insert: [HorizontalRule] } });
        wg.dom.parentElement?.remove();
        return log;
      };
      expect(run(ReactWordgard.create)).toEqual(run(Wordgard.create));
    });
  });

  it("refuses content it can't render yet", () => {
    const Blank = Leaf.define("Blank", {
      inline: true,
      shape: { structure: Elt.mk("span", { class: "blank" }, [""]) },
      parseRules: [{ selector: "span.blank", precedence: 10 }],
    });
    const blankConfig = [...config, GardState.schemaElement.of(Blank)];
    expect(() =>
      ReactWordgard.create({ doc: '<p>a<span class="blank"></span>b</p>', config: blankConfig })
    ).toThrow(/can't render the shape of Blank/);
  });
});
