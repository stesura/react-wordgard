import { Leaf } from "wordgard/doc";
import { basicSchema } from "wordgard/schema";
import { GardState, type Transaction } from "wordgard/state";
import { Paragraph } from "wordgard/types";

import { unchangedEnds } from "../changes.js";

// Four paragraphs of two characters: each takes 4 positions, the second starts
// at 4.
const state = GardState.create({
  doc: "<p>ab</p><p>cd</p><p>ef</p><p>gh</p>",
  config: basicSchema(),
});

const ends = (spec: Transaction.Spec, changes?: readonly number[]) => {
  const tr = state.update(spec);
  return unchangedEnds(changes ?? tr.changes.sections, state.doc, 0, tr.state.doc);
};

describe("unchangedEnds", () => {
  it("leaves out the child an edit is in", () => {
    expect(ends({ changes: { from: 6, insert: [Leaf.text("x")] } })).toEqual({ head: 1, tail: 2 });
  });

  it("leaves out the children beside an inserted one", () => {
    expect(ends({ changes: { from: 8, insert: [Paragraph.create()] } })).toEqual({
      head: 1,
      tail: 1,
    });
  });

  it("leaves out both children a zero-length change touches", () => {
    // A decoration redrawn between the second and third paragraphs.
    expect(ends({}, [8, -1, 0, -2, 8, -1])).toEqual({ head: 1, tail: 1 });
  });

  it("takes in every child an update keeps", () => {
    expect(ends({}, [16, -1])).toEqual({ head: 4, tail: 0 });
  });

  it("takes in no child when the change covers them all", () => {
    expect(ends({}, [16, -2])).toEqual({ head: 0, tail: 0 });
  });
});
