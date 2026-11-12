// Modelled on react-prosemirror's reactKeys tests: keys follow nodes through
// edits, and new nodes get new ones.
import { Leaf, type Plot } from "wordgard/doc";
import { joinBackward, splitTextblock } from "wordgard/command";
import { basicSchema, blockquote, codeBlock, image } from "wordgard/schema";
import { GardState, type Transaction } from "wordgard/state";
import { CodeBlock, Heading, Image, Paragraph } from "wordgard/types";

import { type ReactKeys, addFreshKeys, mapKeys } from "../reactKeys.js";

type Editor = { state: GardState; keys: ReactKeys };

const start = (doc: string, anchor = 0): Editor => {
  const state = GardState.create({
    doc,
    config: [basicSchema(), blockquote(), codeBlock(), image()],
    selection: { anchor },
  });
  const keys: ReactKeys = new WeakMap();
  addFreshKeys(keys, state.doc);
  return { state, keys };
};

// `merge` joins adjacent replaced sections, as Wordgard's update does before
// the view gets them.
const apply = ({ state, keys }: Editor, spec: Transaction.Spec | false, merge = false): Editor => {
  if (!spec) throw new Error("Command didn't apply");
  const tr = state.update(spec);
  const sections: number[] = [];
  const { sections: changes } = tr.changes;
  for (let i = 0; i < changes.length; i += 2) {
    const len = changes[i] ?? 0;
    const ins = changes[i + 1] ?? 0;
    const last = sections.length - 1;
    if (merge && last > 0 && ins >= 0 && (sections[last] ?? -1) >= 0) {
      sections[last - 1] = (sections[last - 1] ?? 0) + len;
      sections[last] = (sections[last] ?? 0) + ins;
    } else sections.push(len, ins);
  }
  mapKeys(keys, state.doc, tr.state.doc, sections);
  return { state: tr.state, keys };
};

const keysOf = ({ keys }: Editor, plot: Plot) => {
  const found = keys.get(plot);
  if (!found) throw new Error("No keys");
  return found;
};

const firstChild = (plot: Plot) => {
  const [child] = plot.content;
  if (!child?.isPlot) throw new Error("No plot");
  return child;
};

describe("reactKeys", () => {
  it("gives every node a key, and text none", () => {
    const editor = start("<p>a</p><p>b</p><blockquote><p>c</p></blockquote>");
    const top = keysOf(editor, editor.state.doc);
    expect(new Set(top).size).toBe(3);
    expect(keysOf(editor, firstChild(editor.state.doc))).toEqual([""]);
  });

  it("keeps a paragraph's key when typing in it", () => {
    const before = start("<p>ab</p><p>cd</p>");
    const after = apply(before, { changes: { from: 2, insert: [Leaf.text("x")] } });
    expect(keysOf(after, after.state.doc)).toEqual(keysOf(before, before.state.doc));
  });

  it("moves keys past inserted nodes, which get new ones", () => {
    const before = start("<p>a</p><p>b</p>");
    const after = apply(before, { changes: { from: 0, insert: [Paragraph.create()] } });
    const [fresh, ...rest] = keysOf(after, after.state.doc);
    expect(rest).toEqual(keysOf(before, before.state.doc));
    expect(keysOf(before, before.state.doc)).not.toContain(fresh);
  });

  it("drops the keys of deleted nodes", () => {
    const before = start("<p>a</p><p>b</p><p>c</p>");
    const after = apply(before, { changes: { from: 3, to: 6 } });
    const [a, , c] = keysOf(before, before.state.doc);
    expect(keysOf(after, after.state.doc)).toEqual([a, c]);
  });

  it("keeps the first half's key on a split", () => {
    const before = start("<p>abcd</p>", 3);
    const after = apply(before, splitTextblock(before.state));
    const [first, second] = keysOf(after, after.state.doc);
    expect(first).toBe(keysOf(before, before.state.doc)[0]);
    expect(second).not.toBe(first);
  });

  it("keeps the first paragraph's key on a join", () => {
    const before = start("<p>ab</p><p>cd</p>", 5);
    const after = apply(before, joinBackward(before.state));
    expect(after.state.doc.content.length).toBe(1);
    expect(keysOf(after, after.state.doc)).toEqual([keysOf(before, before.state.doc)[0]]);
  });

  it("keeps the key through a parameter change, not a type change", () => {
    const before = start("<h1>a</h1><p>b</p>");
    const [h1, p] = keysOf(before, before.state.doc);
    const retagged = apply(before, { changes: { from: 0, to: 1, insert: [Heading.of(2)] } });
    expect(retagged.state.doc.content[0]?.name).toBe("Heading");
    expect(keysOf(retagged, retagged.state.doc)).toEqual([h1, p]);
    const retyped = apply(before, { changes: { from: 3, to: 4, insert: [CodeBlock] } });
    const [, code] = keysOf(retyped, retyped.state.doc);
    expect(retyped.state.doc.content[1]?.name).toBe("CodeBlock");
    expect(code).not.toBe(p);
  });

  it("keeps the keys of adjacent leaves retagged together, not of others", () => {
    const before = start('<p><img src="a"><img src="b"><img src="c"></p>');
    const [a, b, c] = keysOf(before, firstChild(before.state.doc));
    const retagged = apply(
      before,
      {
        changes: [
          { from: 1, to: 2, insert: [Image.of("x")] },
          { from: 2, to: 3, insert: [Image.of("y")] },
        ],
      },
      true
    );
    expect(keysOf(retagged, firstChild(retagged.state.doc))).toEqual([a, b, c]);
    // The middle image replaced by text: the others keep their keys.
    const replaced = apply(
      before,
      {
        changes: [
          { from: 1, to: 2, insert: [Image.of("x")] },
          { from: 2, to: 3, insert: [Leaf.text("t")] },
        ],
      },
      true
    );
    const [x, , last] = keysOf(replaced, firstChild(replaced.state.doc));
    expect([x, last]).toEqual([a, c]);
  });

  it("keeps a moved node's key, and its content's, within one parent", () => {
    const before = start("<blockquote><p>a</p></blockquote><p>b</p><p>c</p>");
    const [quote, b, c] = keysOf(before, before.state.doc);
    const moved = firstChild(before.state.doc);
    const inner = keysOf(before, moved);
    const after = apply(before, {
      changes: [
        { from: 0, to: moved.length },
        { from: before.state.doc.length, insert: [moved] },
      ],
    });
    expect(after.state.doc.content[2]).toBe(moved);
    expect(keysOf(after, after.state.doc)).toEqual([b, c, quote]);
    expect(keysOf(after, moved)).toBe(inner);
  });

  it("keeps the keys of two adjacent leaves swapped, by identity", () => {
    const before = start('<p><img src="a"><img src="b"></p>');
    const [a, b] = keysOf(before, firstChild(before.state.doc));
    const [imgA] = firstChild(before.state.doc).content;
    if (!imgA) throw new Error("No image");
    // The kept image between the two changes keeps the sections apart.
    const after = apply(
      before,
      {
        changes: [
          { from: 1, to: 2 },
          { from: 3, insert: [imgA] },
        ],
      },
      true
    );
    expect(firstChild(after.state.doc).content[1]).toBe(imgA);
    expect(keysOf(after, firstChild(after.state.doc))).toEqual([b, a]);
    // One replaced section of unchanged length, as a retag of both is: identity
    // wins over the retag rule.
    const [, imgB] = firstChild(before.state.doc).content;
    if (!imgB) throw new Error("No image");
    const swapped = apply(before, { changes: { from: 1, to: 3, insert: [imgB, imgA] } });
    expect(keysOf(swapped, firstChild(swapped.state.doc))).toEqual([b, a]);
  });

  it("gives a copy of a node that stays its own key", () => {
    const before = start("<p>a</p><p>b</p>");
    const [a, b] = keysOf(before, before.state.doc);
    const copied = before.state.doc.content[0];
    if (!copied) throw new Error("No paragraph");
    const after = apply(before, { changes: { from: 6, insert: [copied] } });
    const [first, second, copy] = keysOf(after, after.state.doc);
    expect([first, second]).toEqual([a, b]);
    expect(copy).not.toBe(a);
  });

  it("uses a moved node's key once when it's inserted twice", () => {
    const before = start("<p>a</p><p>b</p>");
    const [a] = keysOf(before, before.state.doc);
    const moved = before.state.doc.content[0];
    if (!moved) throw new Error("No paragraph");
    const after = apply(before, {
      changes: [
        { from: 0, to: 3 },
        { from: 6, insert: [moved, moved] },
      ],
    });
    const keys = keysOf(after, after.state.doc);
    expect(keys.filter((key) => key == a)).toHaveLength(1);
    expect(new Set(keys).size).toBe(3);
  });

  it("gives a node moved to another parent a new key", () => {
    const before = start("<blockquote><p>a</p></blockquote><p>b</p>");
    const quote = firstChild(before.state.doc);
    const [inner] = keysOf(before, quote);
    const moved = firstChild(quote);
    // The quote's paragraph goes to the end of the document; the quote gets an
    // empty one.
    const after = apply(before, {
      changes: [
        { from: 1, to: 4, insert: [Paragraph.create()] },
        { from: before.state.doc.length, insert: [moved] },
      ],
    });
    expect(after.state.doc.content[2]).toBe(moved);
    expect(keysOf(after, after.state.doc)[2]).not.toBe(inner);
  });

  it("keeps nested keys inside a changed parent", () => {
    const before = start("<blockquote><p>a</p><p>b</p></blockquote>");
    const quote = firstChild(before.state.doc);
    const after = apply(before, { changes: { from: 2, insert: [Leaf.text("x")] } });
    expect(keysOf(after, firstChild(after.state.doc))).toEqual(keysOf(before, quote));
  });

  it("doesn't touch plots that kept their identity", () => {
    const before = start("<blockquote><p>a</p></blockquote><p>b</p>");
    const quote = firstChild(before.state.doc);
    const quoteKeys = keysOf(before, quote);
    const after = apply(before, { changes: { from: 6, insert: [Leaf.text("x")] } });
    expect(firstChild(after.state.doc)).toBe(quote);
    expect(keysOf(after, quote)).toBe(quoteKeys);
  });
});
