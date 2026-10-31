// Modelled on react-prosemirror's reactKeys tests: keys follow nodes through
// edits, and new nodes get new ones.
import { Leaf, type Plot } from "wordgard/doc";
import { joinBackward, splitTextblock } from "wordgard/command";
import { basicSchema, codeBlock } from "wordgard/schema";
import { GardState, type Transaction } from "wordgard/state";
import { CodeBlock, Heading, Paragraph } from "wordgard/types";

import { type ReactKeys, addFreshKeys, mapKeys } from "../reactKeys.js";

type Editor = { state: GardState; keys: ReactKeys };

const start = (doc: string, anchor = 0): Editor => {
  const state = GardState.create({
    doc,
    config: [basicSchema(), codeBlock()],
    selection: { anchor },
  });
  const keys: ReactKeys = new WeakMap();
  addFreshKeys(keys, state.doc);
  return { state, keys };
};

const apply = ({ state, keys }: Editor, spec: Transaction.Spec | false): Editor => {
  if (!spec) throw new Error("Command didn't apply");
  const tr = state.update(spec);
  mapKeys(keys, state.doc, tr.state.doc, tr.changes.sections);
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
    const after = apply(before, { changes: { from: 5, insert: [Leaf.text("x")] } });
    expect(firstChild(after.state.doc)).toBe(quote);
    expect(keysOf(after, quote)).toBe(quoteKeys);
  });
});
