// React's tree draws the same DOM as Wordgard's own renderer
// and answers the tile queries the same way.
import { createElement, forwardRef, useState } from "react";
import { flushSync } from "react-dom";
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
  Alignment,
  Blockquote,
  CaptionedFigure,
  Cell,
  ColSpan,
  Color,
  Emphasis,
  Figure,
  HeaderCell,
  Heading,
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
import { type MarkComponentProps, createMarkShape } from "../decorations/ReactMarkType.js";
import { createWidgetType, createWidgetTypeWithRender } from "../decorations/ReactWidgetType.js";
import { isSilencedWarning } from "../helpers/props.js";
import { useNodePos } from "../hooks/useNodePos.js";
import { useWordgard } from "../hooks/useWordgard.js";
import { ReactDocTile, nodeViewOf } from "../tile.js";
import { describeTile, docTileOf, pathOf } from "../testing/tiles.js";
import { type Tile, TileFlag } from "../wordgardInternals.js";

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
  "SVG shapes": '<p>a<svg class="handle"></svg>b</p>',
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

// Wordgard 0.7.0 disconnects the widgets in a node's shape kept through an
// edit inside the node, and doesn't connect them again
// (docs/wordgard-upstream-bugs.md). React's build leaves them connected.
const withoutStrayDisconnect = (log: readonly string[]) => {
  const stray = log.indexOf("disconnect quote");
  return log.filter((_, i) => i != stray);
};

// A mark on rules, to put an element around blocks.
const Boxed = Mark.define("Boxed", { shape: { element: "section" }, target: HorizontalRule });
const BoxView = forwardRef<HTMLElement, MarkComponentProps<HTMLElement>>(({ children }, ref) =>
  createElement("section", { ref }, children)
);

// Attributes React would get wrong through its own props handling.
const Marker = Leaf.define("Marker", {
  inline: true,
  shape: { element: "span", attributes: { class: "marker", draggable: "false", hidden: "" } },
  parseRules: [{ selector: "span.marker", precedence: 10 }],
});

// SVG, whose tags React takes without Wordgard's `svg:` and its attributes
// camelCased.
const svgHandle = Elt.mk("svg:svg", { class: "handle", viewBox: "0 0 20 20" }, [
  Elt.mk("svg:path", { d: "M20 0L0 20", stroke: "#000", "stroke-width": "1.5" }),
  Elt.mk("svg:polygon", { points: "0,20 20,20 20,0", fill: "transparent" }),
]);

const Icon = Leaf.define("Icon", {
  inline: true,
  shape: { structure: svgHandle },
  parseRules: [{ selector: "svg.handle", precedence: 10 }],
});

// Widgets, drawn as spans (or a text node), editable, out of the flow or not.
const label = (text: string) =>
  Object.assign(document.createElement("span"), { className: "w", textContent: text });
const Label = Widget.define<string>({ render: label });
const EditableLabel = Widget.define<string>({ render: label, editable: true });
const Aside = Widget.define<string>({ render: label, inFlow: false });
const TextWidget = Widget.define<string>({ render: (text) => document.createTextNode(text) });

// React widgets drawing what `label` draws, which plain Wordgard draws from
// their `render`: the two views should match.
const LabelView = forwardRef<HTMLSpanElement, { value: string }>(({ value }, ref) =>
  createElement("span", { ref, className: "w" }, value)
);
const ReactLabel = createWidgetTypeWithRender({ render: label, component: LabelView });
const EditableReactLabel = createWidgetTypeWithRender({
  render: label,
  component: LabelView,
  editable: true,
});
const ReactAside = createWidgetTypeWithRender({
  render: label,
  component: LabelView,
  inFlow: false,
});

// Decorations of every kind, each in a document of its own.
const pointAt = (...decos: [Decoration.Point, number][]) =>
  Decoration.Point.source.of(() => Decoration.Point.set(decos));
const rangeOver = (...decos: [Decoration.Range, number, number][]) =>
  Decoration.Range.source.of(() => Decoration.Range.set(decos));
// Wordgard's image resize handle, and MathML.
const svgAndMath = [
  pointAt([Decoration.Point.wrapper(Elt.mk("span", { class: "resize" }, [svgHandle, 0])), 2]),
  Decoration.Tag.shape(
    HorizontalRule,
    Elt.mk("math:math", [Elt.mk("math:mi", { mathvariant: "bold" }, ["x"])])
  ),
];
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
  // Ranges over three layers, which a cursor seeks into.
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
  "SVG and MathML": [`<p>a<img src="${img}">b</p><hr>`, svgAndMath],
  // Block buffers beside the uneditable rules, in the document and the quote.
  "uneditable blocks": [
    "<hr><hr><p>a</p><blockquote><hr></blockquote><hr>",
    Decoration.Tag.shape(HorizontalRule, Elt.mk("div", { class: "rule" })),
  ],
  // A point shape without a hole draws the quote as an atom.
  "atom point shapes": [
    "<blockquote><p>ab</p></blockquote><p>c</p>",
    pointAt([Decoration.Point.shape(Elt.mk("div", { class: "atom" })), 0]),
  ],
  "React tag and point widgets": [
    "<p>abcd</p><h2>two</h2><p></p><p>ef</p>",
    [
      Decoration.Tag.widget(Paragraph, "before", ReactLabel.of("b")),
      Decoration.Tag.widget(Paragraph, "after", EditableReactLabel.of("a")),
      Decoration.Tag.widget(Paragraph, "start", ReactLabel.of("s")),
      Decoration.Tag.widget(Paragraph, "end", ReactLabel.of("e")),
      pointAt(
        [Decoration.Point.widget(ReactLabel.of("A"), { side: -1 }), 3],
        [Decoration.Point.widget(ReactLabel.of("B"), { side: 0 }), 3],
        [Decoration.Point.widget(Label.of("C"), { side: 1 }), 3],
        [Decoration.Point.widget(ReactAside.of("D")), 13]
      ),
    ],
  ],
  "React widget shapes": [
    `<p>a<img src="${img}">b</p><hr>`,
    [
      Decoration.Tag.shape(Image, (tag) => ReactLabel.of(tag.param.slice(-4))),
      Decoration.Tag.shape(HorizontalRule, EditableReactLabel.of("rule")),
    ],
  ],
  "React widgets inside shapes": [
    `<p>a<img src="${img}">b</p><blockquote><p>q</p></blockquote>`,
    [
      Decoration.Tag.shape(Image, Elt.mk<Widget>("span", { class: "img" }, [ReactLabel.of("i")])),
      Decoration.Tag.shape(
        Blockquote,
        Elt.mk<Widget>("blockquote", [ReactLabel.of("quote"), Elt.mk("div", [0]), Label.of("end")])
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
    Boxed,
    Marker,
    Icon,
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

// WebKit ignores the `targetRanges` option: patched in, as Wordgard's tests do.
const beforeInput = (init: InputEventInit & { targetRanges: StaticRange[] }) => {
  const event = new InputEvent("beforeinput", init);
  if (!event.getTargetRanges().length) event.getTargetRanges = () => init.targetRanges;
  return event;
};

const nodeAt = (root: Node, path: readonly number[]) =>
  path.reduce<Node>((node, i) => {
    const child = node.childNodes[i];
    if (!child) throw new Error("No node at path");
    return child;
  }, root);

// Moves the node at `from` to `to`, both in `state`'s document.
const move = (state: GardState, from: number, to: number): Transaction.Spec => {
  const node = state.doc.nodeAt(from);
  if (!node) throw new Error(`No node at ${from}`);
  return {
    changes: [
      { from, to: from + node.length },
      { from: to, insert: [node] },
    ],
  };
};

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
        // Thousands of posAtCoords calls: WebKit takes over 15 s on a loaded machine.
      }, 60_000);
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
    expect(html("uneditable blocks")).toMatch(
      /^<img class="wg-blockBuffer" alt=""><div class="rule" contenteditable="false"><\/div><img class="wg-blockBuffer" alt="">/
    );
    const ranges = html("range decorations");
    for (const part of ['<mark class="r">', 'data-r="1"']) expect(ranges).toContain(part);
  });

  it("keeps a node's marks' wrappers and attributes on a point shape", () => {
    const { wordgard, react } = both(
      (schema) =>
        schema.doc([
          Paragraph.create([
            Leaf.text("a"),
            Image.of(img, [Strong, Color.of("red")]),
            Leaf.text("b"),
          ]),
        ]),
      pointAt([Decoration.Point.shape(Elt.mk("span", { class: "shaped" })), 2])
    );
    expect(react.contentDOM.innerHTML).toBe(
      '<p>a<strong><span class="shaped" contenteditable="false" style="color: red"></span></strong>b</p>'
    );
    expect(react.contentDOM.innerHTML).toBe(wordgard.contentDOM.innerHTML);
    expect(describeTile(docTileOf(react), react.contentDOM)).toEqual(
      describeTile(docTileOf(wordgard), wordgard.contentDOM)
    );
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

    it("puts block buffers beside uneditable blocks as Wordgard does", () => {
      const rule = Decoration.Tag.shape(HorizontalRule, Elt.mk("div", { class: "rule" }));
      const { wordgard, react } = both("<hr><hr><p>a</p><blockquote><hr></blockquote><hr>", rule);
      const steps: Transaction.Spec["changes"][] = [
        { from: 4, insert: [Leaf.text("b")] },
        { from: 2, to: 6 },
        { from: 4, insert: [HorizontalRule] },
        { from: 0, to: 1 },
        { from: 0, insert: [Paragraph.create([Leaf.text("x")])] },
        { from: 3, to: 4 },
      ];
      for (const changes of steps) {
        for (const wg of [wordgard, react]) edit(wg, changes);
        expect(react.contentDOM.innerHTML).toBe(wordgard.contentDOM.innerHTML);
        expect(describeTile(docTileOf(react), react.contentDOM)).toEqual(
          describeTile(docTileOf(wordgard), wordgard.contentDOM)
        );
      }
    });

    it("puts block buffers inside a React mark around uneditable blocks, as Wordgard does", () => {
      const { wordgard, react } = both("<p>a</p><hr><hr><p>b</p>", [
        Decoration.Tag.shape(HorizontalRule, Elt.mk("div", { class: "rule" })),
        Decoration.Mark.shape(Boxed, createMarkShape(BoxView, { element: "section" })),
      ]);
      for (const wg of [wordgard, react]) edit(wg, { from: 3, to: 5, add: Boxed });
      const rule = '<div class="rule" contenteditable="false"></div>';
      const buffer = '<img class="wg-blockBuffer" alt="">';
      expect(react.contentDOM.innerHTML).toContain(
        `<section>${buffer}${rule}${buffer}${rule}${buffer}</section>`
      );
      // Plain Wordgard keeps the attribute marking a React mark's element.
      const plain = wordgard.contentDOM.innerHTML.replace(/ data-wg-react="\w+"/g, "");
      expect(react.contentDOM.innerHTML).toBe(plain);
    });

    it("redraws what changed in a plot while an atom point shape covered it", () => {
      const set = Transaction.Effect.define<{ atom: boolean; range: boolean }>();
      const field = GardState.Field.define({
        create: () => ({ atom: false, range: false }),
        update: (value: { atom: boolean; range: boolean }, tr: Transaction) =>
          tr.effects.find((effect) => effect.is(set))?.value ?? value,
      });
      const atom = Decoration.Point.set([
        [Decoration.Point.shape(Elt.mk("div", { class: "atom" })), 0],
      ]);
      const noPoints = Decoration.Point.set([]);
      const range = Decoration.Range.set([[Decoration.Range.wrapper("mark", {}), 2, 4]]);
      const noRanges = Decoration.Range.set([]);
      const extra = [
        field,
        Decoration.Point.source.of((state) => (state.field(field).atom ? atom : noPoints)),
        Decoration.Range.source.of((state) => (state.field(field).range ? range : noRanges)),
      ];
      const { wordgard, react } = both("<blockquote><p>ab</p></blockquote>", extra);
      const steps = [
        { atom: true, range: false },
        { atom: true, range: true },
        { atom: false, range: true },
      ];
      for (const value of steps) {
        for (const wg of [wordgard, react]) {
          wg.dispatch({ effects: set.of(value) });
          wg.flush();
        }
        expect(react.contentDOM.innerHTML).toBe(wordgard.contentDOM.innerHTML);
      }
      expect(react.contentDOM.innerHTML).toContain("<mark>");
    });

    it("draws a plot an atom point shape covers as Wordgard does through edits inside it", () => {
      const atom = pointAt([Decoration.Point.shape(Elt.mk("div", { class: "atom" })), 0]);
      const { wordgard, react } = both("<blockquote><p>ab</p></blockquote><p>c</p>", atom);
      for (const changes of [
        { from: 3, insert: [Leaf.text("x")] },
        { from: 2, to: 4 },
      ]) {
        for (const wg of [wordgard, react]) edit(wg, changes);
        expect(react.contentDOM.innerHTML).toBe(wordgard.contentDOM.innerHTML);
        expect(describeTile(docTileOf(react), react.contentDOM)).toEqual(
          describeTile(docTileOf(wordgard), wordgard.contentDOM)
        );
      }
    });

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

    // A kept layout follows its plot, so the next edit keeps it too.
    it("keeps them edit after edit", () => {
      const { react } = both("<p>a</p><p>b</p><p>c</p>");
      const kept = blockIn(react.contentDOM, 2).wgTile;
      edit(react, { from: 1, insert: [Leaf.text("x")] });
      edit(react, { from: 1, insert: [Leaf.text("y")] });
      expect(blockIn(react.contentDOM, 2).wgTile).toBe(kept);
    });

    // Inside a plot that moved while kept.
    it("keeps them edit after edit in nested plots", () => {
      const { react } = both("<p>a</p><blockquote><p>b</p><p>c</p></blockquote>");
      const kept = blockIn(react.contentDOM, 1).children[0]?.wgTile;
      edit(react, { from: 1, insert: [Leaf.text("x")] });
      edit(react, { from: 10, insert: [Leaf.text("y")] });
      expect(blockIn(react.contentDOM, 1).textContent).toBe("bcy");
      expect(blockIn(react.contentDOM, 1).children[0]?.wgTile).toBe(kept);
    });

    // A heading's level changes its element, which React draws anew under the
    // same key; the chip inside keeps its layout, and its line break's view.
    it("builds tiles over the new DOM of a kept layout React drew again", () => {
      const { wordgard, react } = both('<h1>a <span class="chip">b<br>c</span> d</h1><p>e</p>');
      for (const changes of [
        { from: 0, to: 1, insert: [Heading.of(2)] },
        { from: 5, insert: [Leaf.text("x")] },
      ]) {
        for (const wg of [wordgard, react]) edit(wg, changes);
        expect(react.contentDOM.innerHTML).toBe(wordgard.contentDOM.innerHTML);
        expect(describeTile(docTileOf(react), react.contentDOM)).toEqual(
          describeTile(docTileOf(wordgard), wordgard.contentDOM)
        );
      }
    });

    // React keeps the moved nodes' DOM, and the tiles are built over it.
    it("draws nodes moved within their parent as Wordgard does", () => {
      const { wordgard, react } = both(
        `<p>a <span class="chip">b <em>c</em></span> d<img src="${img}"></p>` +
          `<blockquote><p>q<span class="atom">x</span></p><ul><li><p>l</p></li></ul></blockquote>` +
          `<figure><img src="${img}"></figure><p><img src="${img}"><img src="${img}#2">e</p>`
      );
      const quote = react.contentDOM.querySelector("blockquote");
      const steps = [
        // The quote to the start; the chip past the image; the figure to the
        // end; two images swapped.
        (state: GardState) => move(state, state.doc.content[0]?.length ?? 0, 0),
        (state: GardState) => {
          const p = state.doc.content[0]?.length ?? 0;
          return move(state, p + 3, p + 3 + 5 + 3);
        },
        (state: GardState) => {
          const [first, second] = state.doc.content;
          return move(state, (first?.length ?? 0) + (second?.length ?? 0), state.doc.length);
        },
        (state: GardState) => {
          const [first, second] = state.doc.content;
          const p = (first?.length ?? 0) + (second?.length ?? 0);
          return move(state, p + 1, p + 3);
        },
      ];
      for (const step of steps) {
        for (const wg of [wordgard, react]) edit(wg, step(wg.state).changes);
        expect(react.contentDOM.innerHTML).toBe(wordgard.contentDOM.innerHTML);
        expect(describeTile(docTileOf(react), react.contentDOM)).toEqual(
          describeTile(docTileOf(wordgard), wordgard.contentDOM)
        );
      }
      expect(react.contentDOM.querySelector("blockquote")).toBe(quote);
    });

    // A mark on the paragraph's tag changes the paragraph, not its content:
    // React skips the content (ChildNodeViews' memo).
    it("keeps the layout of a paragraph's content when its alignment changes", () => {
      const { wordgard, react } = both("<p>a</p><p>b <strong>c</strong> d</p><p>e</p>");
      const paragraph = () => blockIn(react.contentDOM, 1);
      const content = (tile: Tile | undefined) => (tile ? nodeViewOf(tile)?.children : undefined);
      const before = content(paragraph().wgTile);
      const strong = paragraph().querySelector("strong");
      for (const wg of [wordgard, react]) edit(wg, { from: 3, add: Alignment.of("center") });
      expect(paragraph().getAttribute("style")).toBe("text-align: center");
      expect(before).toBeDefined();
      expect(content(paragraph().wgTile)).toBe(before);
      expect(paragraph().querySelector("strong")).toBe(strong);
      expect(react.contentDOM.innerHTML).toBe(wordgard.contentDOM.innerHTML);
      expect(describeTile(docTileOf(react), react.contentDOM)).toEqual(
        describeTile(docTileOf(wordgard), wordgard.contentDOM)
      );
    });

    // The copy is laid out first: the original mustn't take its layout.
    it("lays out a plot inserted right before itself apart from it", () => {
      const { wordgard, react } = both("<blockquote><p>a</p></blockquote>");
      for (const wg of [wordgard, react]) {
        const [quote] = wg.state.doc.content;
        if (quote) edit(wg, { from: 0, insert: [quote] });
      }
      for (const changes of [null, { from: 7, insert: [Leaf.text("y")] }]) {
        if (changes) for (const wg of [wordgard, react]) edit(wg, changes);
        expect(react.contentDOM.innerHTML).toBe(wordgard.contentDOM.innerHTML);
        expect(describeTile(docTileOf(react), react.contentDOM)).toEqual(
          describeTile(docTileOf(wordgard), wordgard.contentDOM)
        );
      }
      const [first, second] = docTileOf(react).children;
      expect(first?.children[0]?.parent).toBe(first);
      expect(second?.children[0]?.parent).toBe(second);
    });

    // Typing changes one text run: the others, and the marks, keep their views,
    // so React skips them (MarkView's and TextNodeView's memos).
    it("keeps the views of the runs typing doesn't change", () => {
      const { wordgard, react } = both("<p>b <strong>c</strong> <em>d</em> e</p>");
      const content = () => nodeViewOf(blockIn(react.contentDOM, 0).wgTile ?? docTileOf(react));
      const before = content()?.children;
      for (const wg of [wordgard, react]) edit(wg, { from: 1, insert: [Leaf.text("x")] });
      const after = content()?.children;
      expect(after).not.toBe(before);
      expect(after?.[0]).not.toBe(before?.[0]);
      expect(after?.slice(1)).toEqual(before?.slice(1));
      after?.slice(1).forEach((view, i) => expect(view).toBe(before?.[i + 1]));
      expect(react.contentDOM.innerHTML).toBe(wordgard.contentDOM.innerHTML);
      expect(describeTile(docTileOf(react), react.contentDOM)).toEqual(
        describeTile(docTileOf(wordgard), wordgard.contentDOM)
      );
    });

    // A parameter moving the content hole within the same element: the
    // paragraphs inside keep their layouts and stay where they were.
    it("keeps the content of an element whose hole moves", () => {
      const Box = Plot.Type.define<string>("Box", {
        validate: "string",
        blockContent: DocNode.Group.Content,
        group: DocNode.Group.Content,
        shape: {
          structure: (side) =>
            Elt.mk("div", { class: "box" }, side == "before" ? ["L", 0] : [0, "L"]),
          atom: false,
        },
      });
      const { wordgard, react } = both("<p>x</p>", GardState.schemaElement.of([Box]));
      const box = Box.of("before").create([
        Paragraph.create([Leaf.text("a")]),
        Paragraph.create([Leaf.text("b")]),
      ]);
      edit(wordgard, { from: 0, insert: [box] });
      edit(react, { from: 0, insert: [box] });
      const a = blockIn(react.contentDOM, 0).querySelector("p");
      for (const changes of [
        { from: 0, to: 1, insert: [Box.of("after")] },
        { from: 6, insert: [Leaf.text("y")] },
      ]) {
        for (const wg of [wordgard, react]) edit(wg, changes);
        expect(react.contentDOM.innerHTML).toBe(wordgard.contentDOM.innerHTML);
        expect(describeTile(docTileOf(react), react.contentDOM)).toEqual(
          describeTile(docTileOf(wordgard), wordgard.contentDOM)
        );
      }
      expect(blockIn(react.contentDOM, 0).querySelector("p")).toBe(a);
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
    {
      doc: string;
      steps: CompositionStep[];
      start?: (content: HTMLElement) => Text;
      extra?: GardState.Extension;
    }
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
    // In a shape with a React header, beside a React widget.
    "beside React widgets": {
      doc: "<blockquote><p>ab</p></blockquote>",
      extra: [
        Decoration.Tag.shape(
          Blockquote,
          Elt.mk<Widget>("blockquote", [ReactLabel.of("quote"), Elt.mk("div", [0])])
        ),
        Decoration.Tag.widget(Paragraph, "start", ReactLabel.of("|")),
        pointAt([Decoration.Point.widget(ReactLabel.of("x")), 4]),
      ],
      steps: [
        { from: 3, to: 3, text: "-" },
        { from: 3, to: 4, text: "*" },
        { from: 4, to: 4, text: "$" },
      ],
    },
  };

  for (const [name, { doc, steps, start, extra }] of Object.entries(compositions)) {
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
          fire(beforeInput({ ...init, targetRanges: [range] }));
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
      const expected = alone(Wordgard.create, doc, run, extra);
      expect(JSON.stringify(expected)).toContain(
        `"flags":${TileFlag.Composition | TileFlag.Synced}`
      );
      expect(alone(ReactWordgard.create, doc, run, extra)).toEqual(expected);
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
        wg.contentDOM.dispatchEvent(beforeInput({ inputType, data, targetRanges: [range] }));
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
    react.dispatch({ changes: { from: 1, to: 3, insert: [Leaf.Text.of("")] } });
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
      '<p>a<span class="atom" contenteditable="false"></span>b</p>'
    );
    expect(html(docs["shape attributes"])).toContain('draggable="false" hidden=""');
    expect(html(docs["shape attributes"])).toContain('<td colspan="2" rowspan="2">');
    expect(html(docs["inline plots"])).toContain(
      '<span class="chip"><img class="wg-buffer" alt="">chip <em>b</em><img class="wg-buffer" alt=""></span>'
    );
  });

  it("moves the points a spanning wrapper continues over into it, as Wordgard does", () => {
    const { react, wordgard } = both(
      "<p><strong>ab</strong></p>",
      pointAt([Decoration.Point.widget(Label.of("w")), 2])
    );
    const dom = react.contentDOM;
    expect(dom.innerHTML).toBe('<p><strong>a<span class="w">w</span>b</strong></p>');
    expect(wordgard.contentDOM.innerHTML).toBe(dom.innerHTML);
    expect(dom.querySelector(".w")?.wgTile?.parent?.dom).toBe(dom.querySelector("strong"));
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
        // Moved within their parent: the quote to the start, an image past
        // the text after it.
        step(move(wg.state, 6, 0));
        const p = wg.state.doc.content[0]?.length ?? 0;
        step(move(wg.state, p + 3, p + 5));
        step({ changes: { from: 0, to: wg.state.doc.length, insert: [HorizontalRule] } });
        wg.dom.parentElement?.remove();
        return log;
      };
      expect(run(ReactWordgard.create)).toEqual(withoutStrayDisconnect(run(Wordgard.create)));
    });
  });

  describe("with React widgets", () => {
    const edit = (wg: Wordgard, spec: Transaction.Spec) => {
      wg.dispatch(spec);
      wg.flush();
    };
    const flip = Transaction.Effect.define<null>();
    const points = GardState.Field.define({
      create: () =>
        Decoration.Point.set([
          [Decoration.Point.widget(ReactLabel.of("x")), 2],
          [Decoration.Point.widget(EditableReactLabel.of("y"), { side: -1 }), 7],
        ]),
      update: (set: Decoration.Point.Set, tr: Transaction) =>
        tr.effects.some((effect) => effect.is(flip))
          ? Decoration.Point.set([[Decoration.Point.widget(ReactLabel.of("z")), 2]])
          : set.map(tr.changes),
      provide: (field) => Decoration.Point.source.of((state) => state.field(field)),
    });
    const widgets = [
      points,
      Decoration.Tag.widget(Image, "before", ReactLabel.of("<")),
      Decoration.Tag.widget(Image, "after", ReactLabel.of(">")),
      Decoration.Tag.widget(Paragraph, "start", ReactLabel.of("|")),
    ];
    const doc = `<p>ab<img src="${img}">cd</p><p>ef</p>`;
    const steps: Transaction.Spec[] = [
      { changes: { from: 1, insert: [Leaf.text("x")] } },
      { changes: { from: 0, insert: [Paragraph.create([Leaf.text("new")])] } },
      { changes: { from: 9, to: 10, insert: [Image.of(`${img}#2`)] } },
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
          edit(wg, spec);
          return [...wg.contentDOM.querySelectorAll(".w")].map((w) => before.includes(w));
        };
        expect(reuse(react)).toEqual(reuse(wordgard));
        expect(react.contentDOM.innerHTML).toBe(wordgard.contentDOM.innerHTML);
        expect(describeTile(docTileOf(react), react.contentDOM)).toEqual(
          describeTile(docTileOf(wordgard), wordgard.contentDOM)
        );
      }
    });

    // Inside a plot that moved while kept, as in Wordgard.
    it("keeps a React point widget's node in a nested plot edit after edit", () => {
      const mapped = GardState.Field.define({
        create: () => Decoration.Point.set([[Decoration.Point.widget(ReactLabel.of("x")), 6]]),
        update: (set: Decoration.Point.Set, tr: Transaction) => set.map(tr.changes),
        provide: (field) => Decoration.Point.source.of((state) => state.field(field)),
      });
      const { wordgard, react } = both("<p>a</p><blockquote><p>bc</p></blockquote>", mapped);
      for (const spec of [
        { changes: { from: 1, insert: [Leaf.text("x")] } },
        { changes: { from: 6, insert: [Leaf.text("y")] } },
      ]) {
        const reuse = (wg: Wordgard) => {
          const before = [...wg.contentDOM.querySelectorAll(".w")];
          edit(wg, spec);
          return [...wg.contentDOM.querySelectorAll(".w")].map((w) => before.includes(w));
        };
        expect(reuse(react)).toEqual(reuse(wordgard));
        expect(react.contentDOM.innerHTML).toBe(wordgard.contentDOM.innerHTML);
      }
      expect(react.contentDOM.querySelector(".w")?.parentElement?.textContent).toBe("ybxc");
    });

    // Shows the value it was mounted with and the current one: a remount resets
    // the first.
    const Mounted = forwardRef<HTMLSpanElement, { value: string }>(({ value }, ref) => {
      const [first] = useState(value);
      return createElement("span", { ref, className: "m" }, `${first}:${value}`);
    });
    const ReactMounted = createWidgetTypeWithRender({ render: label, component: Mounted });
    const setPoint = Transaction.Effect.define<string>();
    // A React point widget whose value changes on `setPoint`, where it is.
    const point = GardState.Field.define({
      create: () => ({ value: "p", pos: 2 }),
      update: ({ value, pos }: { value: string; pos: number }, tr: Transaction) => ({
        value: tr.effects.find((effect) => effect.is(setPoint))?.value ?? value,
        pos: tr.changes.mapPos(pos),
      }),
      provide: (field) =>
        Decoration.Point.source.of((state) => {
          const { value, pos } = state.field(field);
          return Decoration.Point.set([[Decoration.Point.widget(ReactMounted.of(value)), pos]]);
        }),
    });
    const everywhere = [
      point,
      Decoration.Tag.widget(Paragraph, "start", ReactMounted.of("t")),
      Decoration.Tag.shape(Image, (tag) => ReactMounted.of(tag.param.slice(-2))),
      Decoration.Tag.shape(
        Blockquote,
        Elt.mk<Widget>("blockquote", [ReactMounted.of("q"), Elt.mk("div", [0])])
      ),
    ];
    const placed = `<p>ab<img src="${img}#1">cd</p><blockquote><p>q</p></blockquote>`;

    it("keeps a React widget's instance while it's equal, and re-renders it in place", () => {
      const { react } = both(placed, everywhere);
      const drawn = () => [...react.contentDOM.querySelectorAll(".m")];
      const texts = () => drawn().map((m) => m.textContent);
      const first = drawn();
      expect(texts()).toEqual(["t:t", "p:p", "#1:#1", "q:q", "t:t"]);
      edit(react, { changes: { from: 1, insert: [Leaf.text("x")] } });
      edit(react, { changes: { from: 5, insert: [Leaf.text("y")] } });
      expect(drawn()).toEqual(first);
      edit(react, { effects: setPoint.of("v") });
      edit(react, { changes: { from: 4, to: 5, insert: [Image.of(`${img}#2`)] } });
      expect(drawn()).toEqual(first);
      expect(texts()).toEqual(["t:t", "p:v", "#1:#2", "q:q", "t:t"]);
      // A new paragraph gets its own.
      edit(react, { changes: { from: 0, insert: [Paragraph.create([Leaf.text("new")])] } });
      expect(drawn().slice(1)).toEqual(first);
    });

    it("gives React widgets the editor and their position", () => {
      const seen: [Wordgard, () => number][] = [];
      const Probe = forwardRef<HTMLSpanElement, { value: string }>(({ value }, ref) => {
        const wg = useWordgard();
        const pos = useNodePos();
        return createElement(
          "span",
          { ref, className: "w", onClick: () => seen.push([wg, pos]) },
          value
        );
      });
      const ReactProbe = createWidgetTypeWithRender({ render: label, component: Probe });
      const { react } = both(`<p>ab<img src="${img}">c</p><blockquote><p>q</p></blockquote>`, [
        pointAt([Decoration.Point.widget(ReactProbe.of("p")), 2]),
        Decoration.Tag.widget(Paragraph, "start", ReactProbe.of("t")),
        Decoration.Tag.shape(Image, ReactProbe.of("i")),
        Decoration.Tag.shape(
          Blockquote,
          Elt.mk<Widget>("blockquote", [ReactProbe.of("q"), Elt.mk("div", [0])])
        ),
      ]);
      const click = () => {
        seen.length = 0;
        react.contentDOM.querySelectorAll<HTMLElement>(".w").forEach((w) => w.click());
        return seen.map(([wg, pos]) => [wg == react, pos()]);
      };
      // In document order: the paragraph's start, the point, the image, the
      // blockquote's header (inside it), the inner paragraph's start.
      expect(click()).toEqual([
        [true, 1],
        [true, 2],
        [true, 3],
        [true, 7],
        [true, 8],
      ]);
      edit(react, { changes: { from: 1, insert: [Leaf.text("x")] } });
      expect(click().map(([, pos]) => pos)).toEqual([1, 2, 4, 8, 9]);
      const [, image] = seen[2] ?? [];
      edit(react, { changes: { from: 3, to: 5 } });
      expect(() => image?.()).toThrow(/isn't drawn/);
    });

    it("lets a React widget update itself outside the flush without a redraw", () => {
      const Clicks = forwardRef<HTMLSpanElement, { value: string }>(({ value }, ref) => {
        const [clicks, setClicks] = useState(0);
        return createElement(
          "span",
          { ref, className: "w", onClick: () => setClicks(clicks + 1) },
          `${value}${clicks}`
        );
      });
      const ReactClicks = createWidgetTypeWithRender({ render: label, component: Clicks });
      const { react } = both(`<p>ab<img src="${img}"></p><blockquote><p>q</p></blockquote>`, [
        pointAt([Decoration.Point.widget(ReactClicks.of("p")), 2]),
        Decoration.Tag.widget(Paragraph, "end", ReactClicks.of("e")),
        Decoration.Tag.shape(Image, ReactClicks.of("i")),
        Decoration.Tag.shape(
          Blockquote,
          Elt.mk<Widget>("blockquote", [ReactClicks.of("q"), Elt.mk("div", [0])])
        ),
      ]);
      const tile = docTileOf(react);
      const dirty = (tile: Tile): boolean =>
        !!(tile.flags & TileFlag.Dirty) || tile.children.some(dirty);
      const drawn = [...react.contentDOM.querySelectorAll<HTMLElement>(".w")];
      for (const w of drawn) flushSync(() => w.click());
      expect(drawn.map((w) => w.textContent)).toEqual(["p1", "i1", "e1", "q1", "e1"]);
      react.flush();
      expect(dirty(tile)).toBe(false);
      expect(docTileOf(react)).toBe(tile);
      expect([...react.contentDOM.querySelectorAll(".w")]).toEqual(drawn);
    });

    it("connects and disconnects React widgets as Wordgard does", () => {
      const run = (create: Create) => {
        const log: string[] = [];
        const Tracked = createWidgetTypeWithRender({
          render: label,
          component: LabelView,
          connect: (value) => log.push(`connect ${value}`),
          disconnect: (value) => log.push(`disconnect ${value}`),
        });
        const flipPoint = Transaction.Effect.define<null>();
        const tracked = GardState.Field.define({
          create: () => ({ value: "p", pos: 1 }),
          update: ({ value, pos }: { value: string; pos: number }, tr: Transaction) => ({
            value: tr.effects.some((effect) => effect.is(flipPoint)) ? `${value}!` : value,
            pos: tr.changes.mapPos(pos),
          }),
          provide: (field) =>
            Decoration.Point.source.of((state) => {
              const { value, pos } = state.field(field);
              return Decoration.Point.set([[Decoration.Point.widget(Tracked.of(value)), pos]]);
            }),
        });
        const wg = mount(create, `<p>a<img src="${img}">b</p>`, [
          tracked,
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
          edit(wg, spec);
          log.push("|");
        };
        step({ changes: { from: 2, to: 3, insert: [Image.of(`${img}#2`)] } });
        step({ changes: { from: 1, insert: [Leaf.text("x")] } });
        step({ effects: flipPoint.of(null) });
        const quote = Blockquote.create([Paragraph.create([Leaf.text("q"), Image.of(`${img}#3`)])]);
        step({ changes: { from: wg.state.doc.length, insert: [quote] } });
        step({ changes: { from: wg.state.doc.length - 2, insert: [Leaf.text("r")] } });
        // Redrawn without changing: a range wrapper, then a new tag widget (all redrawn).
        const mark = rangeOver([Decoration.Range.wrapper("mark", {}), 1, 6]);
        step({ effects: GardState.appendConfig.of(mark) });
        const start = Decoration.Tag.widget(Paragraph, "start", Tracked.of("s"));
        step({ effects: GardState.appendConfig.of(start) });
        // Moved within their parent: the quote to the start, an image past
        // the text after it.
        step(move(wg.state, 6, 0));
        const p = wg.state.doc.content[0]?.length ?? 0;
        step(move(wg.state, p + 3, p + 5));
        step({ changes: { from: 0, to: wg.state.doc.length, insert: [HorizontalRule] } });
        wg.dom.parentElement?.remove();
        return log;
      };
      expect(run(ReactWordgard.create)).toEqual(withoutStrayDisconnect(run(Wordgard.create)));
    });

    it("leaves a React widget's events to its propagateEvent", () => {
      const Stopping = createWidgetTypeWithRender({
        render: label,
        component: LabelView,
        propagateEvent: false,
      });
      const { react } = both("<p>ab</p>", [
        pointAt(
          [Decoration.Point.widget(ReactLabel.of("a")), 1],
          [Decoration.Point.widget(Stopping.of("s")), 2]
        ),
      ]);
      const ignored = [...react.contentDOM.querySelectorAll(".w")].map((w) =>
        docTileOf(react).nearest(w)?.ignoreEvent(new MouseEvent("mousedown"))
      );
      expect(ignored).toEqual([false, true]);
    });

    it("needs a React widget's component to forward its ref", () => {
      const NoRef = createWidgetTypeWithRender({
        render: label,
        component: ({ value }: { value: string }) => createElement("span", null, value),
      });
      expect(() =>
        mount(ReactWordgard.create, "<p>a</p>", [
          Decoration.Tag.widget(Paragraph, "start", NoRef.of("x")),
        ])
      ).toThrow(/forward its ref/);
    });

    // An image drawn by a React component with its own hover state, which
    // replaces its node on a double click.
    it("draws an image as a React widget with state of its own", async () => {
      const ImageView = forwardRef<HTMLImageElement, { value: string }>(({ value }, ref) => {
        const wg = useWordgard();
        const pos = useNodePos();
        const [hover, setHover] = useState(false);
        const grow = () =>
          wg.dispatch({
            changes: { from: pos(), to: pos() + 1, insert: [Image.of(`${value}#big`)] },
          });
        return createElement("img", {
          ref,
          src: value,
          className: hover ? "hover" : undefined,
          onMouseOver: () => setHover(true),
          onMouseOut: () => setHover(false),
          onDoubleClick: grow,
        });
      });
      const ReactImage = createWidgetTypeWithRender({
        render: (src) => Object.assign(document.createElement("img"), { src }),
        component: ImageView,
      });
      const { wordgard, react } = both(`<p>a<img src="${img}">b</p>`, [
        Decoration.Tag.shape(Image, (tag) => ReactImage.of(tag.param)),
      ]);
      expect(react.contentDOM.innerHTML).toBe(wordgard.contentDOM.innerHTML);
      expect(describeTile(docTileOf(react), react.contentDOM)).toEqual(
        describeTile(docTileOf(wordgard), wordgard.contentDOM)
      );
      const image = react.contentDOM.querySelector("img");
      if (!image) throw new Error("No image");
      const tile = docTileOf(react);
      // React commits a hover later, outside Wordgard's flush.
      image.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      await vi.waitFor(() => expect(image.className).toBe("hover"));
      react.flush();
      expect(docTileOf(react)).toBe(tile);
      edit(react, { changes: { from: 1, insert: [Leaf.text("x")] } });
      image.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
      react.flush();
      expect(react.contentDOM.querySelector("img")).toBe(image);
      expect(image.className).toBe("hover");
      expect(image.getAttribute("src")).toBe(`${img}#big`);
      const found = docTileOf(react).nodeTile(3);
      expect(found?.dom).toBe(image);
      expect(found?.tag?.param).toBe(`${img}#big`);
    });

    it("leaves plain Wordgard an empty placeholder for a React widget", () => {
      const Public = createWidgetType({ component: LabelView });
      const wg = mount(Wordgard.create, "<p>a</p>", [
        Decoration.Tag.widget(Paragraph, "start", Public.of("x")),
      ]);
      expect(wg.contentDOM.innerHTML).toBe("<p><span></span>a</p>");
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

  it("draws SVG and MathML in their namespaces, with nothing for React to warn about", () => {
    const error = vi.spyOn(console, "error");
    try {
      const react = mount(
        ReactWordgard.create,
        `<p>a<img src="${img}">b</p><p><svg class="handle"></svg></p><hr>`,
        [
          svgAndMath,
          // On the SVG leaf: a style, an attribute React doesn't know, and ones
          // React takes camelCased, whose case SVG keeps.
          pointAt([
            Decoration.Point.attributes({
              style: "width: 12px",
              "my-attr": "1",
              tabindex: "-1",
              spellcheck: "false",
            }),
            6,
          ]),
        ]
      );
      editors.push(react);
      const svg = "http://www.w3.org/2000/svg";
      const handles = react.contentDOM.querySelectorAll("svg.handle");
      expect(handles).toHaveLength(2);
      for (const handle of handles) {
        expect(handle.namespaceURI).toBe(svg);
        expect(handle.querySelector("path")?.namespaceURI).toBe(svg);
        expect(handle.querySelector("path")?.getAttribute("stroke-width")).toBe("1.5");
      }
      const icon = react.contentDOM.querySelector("svg.handle[my-attr]");
      expect(icon?.getAttribute("my-attr")).toBe("1");
      expect(icon?.getBoundingClientRect().width).toBe(12);
      expect(icon?.getAttributeNames()).toEqual(
        expect.arrayContaining(["contenteditable", "tabindex", "spellcheck"])
      );
      expect(react.contentDOM.querySelector("mi")?.namespaceURI).toBe(
        "http://www.w3.org/1998/Math/MathML"
      );
      // The console spy sits above our filter, so it sees what the filter drops.
      expect(error.mock.calls.filter((call) => !isSilencedWarning(call))).toEqual([]);
    } finally {
      error.mockRestore();
    }
  });

  it("refuses an SVG element outside <svg>", () => {
    const Stray = Leaf.define("Stray", {
      inline: true,
      shape: { structure: Elt.mk("span", { class: "stray" }, [Elt.mk("svg:path", { d: "M0 0" })]) },
      parseRules: [{ selector: "span.stray", precedence: 10 }],
    });
    expect(() =>
      ReactWordgard.create({
        doc: '<p>a<span class="stray"></span>b</p>',
        config: [...config, GardState.schemaElement.of(Stray)],
      })
    ).toThrow(/can't render the shape of Stray/);
  });
});
