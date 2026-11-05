// Stand-ins for an app's plugins, each written as its editor would have it, to see how handling a
// transaction scales with its steps:
// - highlights: a decoration on each paragraph's last word, away from where the benchmark types: in
//   Wordgard, an Enter splitting a range wrapper in a correction's transaction doubles its drawing
//   (docs/benchmark-results.md);
// - anchors: a position per paragraph, mapped through every transaction;
// - edited: flags every paragraph a transaction touched, with a change of its own (an appended
//   transaction in ProseMirror, a correction in Wordgard).
import type { Node as PMNode } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";
import { DecorationSet, Decoration as PMDecoration } from "prosemirror-view";
import { Decoration } from "wordgard/editor";
import { Correction, GardState } from "wordgard/state";
import { Paragraph } from "wordgard/types";

import { Edited } from "./schemas.js";

const lastWord = 5;

// ProseMirror

const highlightsKey = new PluginKey<DecorationSet>("highlights");

const pmHighlights = new Plugin({
  key: highlightsKey,
  state: {
    init: (_, { doc }) => {
      const decorations: PMDecoration[] = [];
      doc.forEach((node, offset) => {
        const end = offset + 1 + node.content.size;
        if (node.content.size >= lastWord)
          decorations.push(PMDecoration.inline(end - lastWord, end, { class: "highlight" }));
      });
      return DecorationSet.create(doc, decorations);
    },
    apply: (tr, set) => (tr.docChanged ? set.map(tr.mapping, tr.doc) : set),
  },
  props: { decorations: (state) => highlightsKey.getState(state) },
});

const paragraphStarts = (doc: PMNode) => {
  const starts: number[] = [];
  doc.forEach((_, offset) => starts.push(offset + 1));
  return starts;
};

const pmAnchors = new Plugin({
  state: {
    init: (_, { doc }) => paragraphStarts(doc),
    apply: (tr, anchors) => (tr.docChanged ? anchors.map((pos) => tr.mapping.map(pos)) : anchors),
  },
});

// The top-level children that differ, by identity, flagged when they aren't.
const pmEdited = new Plugin({
  appendTransaction: (_, before, after) => {
    const a = before.doc;
    const b = after.doc;
    if (a == b) return null;
    let start = 0;
    while (start < a.childCount && start < b.childCount && a.child(start) == b.child(start))
      start++;
    let endA = a.childCount;
    let endB = b.childCount;
    while (endA > start && endB > start && a.child(endA - 1) == b.child(endB - 1)) {
      endA--;
      endB--;
    }
    const tr = after.tr;
    let pos = 0;
    for (let i = 0; i < start; i++) pos += b.child(i).nodeSize;
    for (let i = start; i < endB; i++) {
      const node = b.child(i);
      if (node.type.name == "paragraph" && !node.attrs.edited)
        tr.setNodeAttribute(pos, "edited", true);
      pos += node.nodeSize;
    }
    return tr.steps.length ? tr : null;
  },
});

export const pmPlugins = [pmHighlights, pmAnchors, pmEdited];

// Wordgard

const highlight = Decoration.Range.wrapper("span", { attributes: { class: "highlight" } });

const wgHighlights = GardState.Field.define<Decoration.Range.Set>({
  create: (state) =>
    Decoration.Range.set((add) => {
      let pos = 0;
      for (const node of state.doc.content) {
        const end = pos + node.length - 1;
        if (node.length - 2 >= lastWord) add(highlight, end - lastWord, end);
        pos += node.length;
      }
    }),
  update: (set, tr) => (tr.docChanged ? set.map(tr.changes) : set),
  // One source reading the field: `source.from(field, (set) => () => set)`
  // gives the view a new source each change, and it redraws every range
  // (about 20 ms and 11 MB a keystroke at 5,000).
  provide: (field) => Decoration.Range.source.of((state) => state.field(field)),
});

const wgAnchors = GardState.Field.define<number[]>({
  create: (state) => {
    const starts: number[] = [];
    let pos = 0;
    for (const node of state.doc.content) {
      starts.push(pos + 1);
      pos += node.length;
    }
    return starts;
  },
  update: (anchors, tr) => (tr.docChanged ? anchors.map((pos) => tr.changes.mapPos(pos)) : anchors),
});

const flag = (edited: string | undefined, before: number) =>
  edited ? null : { from: before, add: Edited.of("true") };

export const wgPlugins = [
  wgHighlights,
  wgAnchors,
  Correction.onContent(Paragraph, (paragraph) =>
    flag(paragraph.node.tag.mark(Edited), paragraph.before)
  ),
  Correction.onMarks(Paragraph, (node) => flag(node.node.tag.mark(Edited), node.before)),
];
