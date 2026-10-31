// R1's "done when": React's tree draws the same DOM as Wordgard's own renderer
// and answers the tile queries the same way.
import { Leaf } from "wordgard/doc";
import { Wordgard } from "wordgard/editor";
import {
  alignment,
  basicSchema,
  blockDoc,
  heading,
  inlineMarks,
  lineBreak,
  paragraph,
} from "wordgard/schema";
import { Color, Emphasis, Strong } from "wordgard/types";

import { ReactWordgard } from "../ReactWordgard.js";
import { ReactDocTile } from "../tile.js";
import { DocTile, type Tile } from "../wordgardInternals.js";

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
};

// Inline marks and alignment (attribute marks on text and on textblocks).
const config = [blockDoc(), paragraph(), heading(), lineBreak(), inlineMarks(), alignment()];

type Create = (spec: Wordgard.Spec) => Wordgard;

const mount = (create: Create, doc: string) => {
  const parent = document.createElement("div");
  parent.style.cssText = "position: absolute; left: 0; top: 0; width: 300px;";
  document.body.appendChild(parent);
  const wg = create({ doc, config, parent });
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

  const both = (doc: string) => {
    const wordgard = mount(Wordgard.create, doc);
    const react = mount(ReactWordgard.create, doc);
    editors.push(wordgard, react);
    return { wordgard, react };
  };

  // posAtCoords hit-tests the page, so each editor is measured on its own.
  const alone = <T>(create: Create, doc: string, f: (wg: Wordgard) => T) => {
    const wg = mount(create, doc);
    try {
      return f(wg);
    } finally {
      wg.dom.parentElement?.remove();
    }
  };

  for (const [name, doc] of Object.entries(docs)) {
    describe(`on ${name}`, () => {
      it("renders through React", () => {
        const { react } = both(doc);
        expect(react.contentDOM.wgTile).toBeInstanceOf(ReactDocTile);
      });

      it("draws the same DOM and tile tree", () => {
        const { wordgard, react } = both(doc);
        expect(react.contentDOM.innerHTML).toBe(wordgard.contentDOM.innerHTML);
        expect(describeTile(docTileOf(react), react.contentDOM)).toEqual(
          describeTile(docTileOf(wordgard), wordgard.contentDOM)
        );
      });

      it("resolves positions and finds node tiles the same way", () => {
        const { wordgard, react } = both(doc);
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
        const { wordgard, react } = both(doc);
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
        expect(alone(ReactWordgard.create, doc, answers)).toEqual(
          alone(Wordgard.create, doc, answers)
        );
      });
    });
  }

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

  it("draws the marks it's given", () => {
    const html = (doc: string) => both(doc).react.contentDOM.innerHTML;
    expect(html(docs["marks of different ranks"])).toContain("<em><strong>cd</strong></em>");
    expect(html(docs["attribute marks"])).toContain(
      '<span style="color: red;background-color: yellow">'
    );
    expect(html(docs["marks on blocks"])).toContain('<p style="text-align: center">');
  });

  it("refuses content it can't render yet", () => {
    expect(() => ReactWordgard.create({ doc: "<p>a<br>b</p>", config: [basicSchema()] })).toThrow(
      /can't render/
    );
  });
});
