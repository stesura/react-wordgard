import { Leaf } from "wordgard/doc";
import { basicSchema } from "wordgard/schema";
import { GardState, type Transaction } from "wordgard/state";
import { Paragraph } from "wordgard/types";

import {
  isKept,
  mapKept,
  mapNodePos,
  pointMapper,
  redrawn,
  samePlace,
  unchangedEnds,
} from "../changes.js";

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

// The helpers as they were, walking the sections, to check the index against.
const walk = (changes: readonly number[]) => {
  const sections: { a: number; endA: number; b: number; endB: number; ins: number }[] = [];
  for (let i = 0, a = 0, b = 0; i < changes.length; i += 2) {
    const len = changes[i] ?? 0;
    const ins = changes[i + 1] ?? 0;
    const endB = b + (ins < 0 ? len : ins);
    sections.push({ a, endA: a + len, b, endB, ins });
    a += len;
    b = endB;
  }
  return sections;
};

const reference = {
  mapNodePos: (changes: readonly number[], pos: number, leaf: boolean) => {
    const sections = walk(changes);
    const s = sections.find((s) => s.endA > pos);
    const last = sections.at(-1);
    if (!s) return { pos: (last?.endB ?? 0) + pos - (last?.endA ?? 0), retagged: false };
    if (s.ins < 0) return { pos: s.b + pos - s.a, retagged: false };
    if (leaf && s.endA - s.a == s.ins) return { pos: s.b + pos - s.a, retagged: true };
    return s.a == pos && s.endA - s.a == 1 && s.ins == 1 ? { pos: s.b, retagged: true } : null;
  },
  mapKept: (changes: readonly number[], pos: number) => {
    const s = walk(changes).find((s) => s.endA > pos);
    return s && s.ins < 0 ? s.b + pos - s.a : null;
  },
  redrawn: (changes: readonly number[], pos: number) => {
    const s = walk(changes).find((s) => s.endB > pos);
    return !!s && s.ins != -1;
  },
  isKept: (changes: readonly number[], from: number, to: number) =>
    !walk(changes).some(
      (s) =>
        s.b <= to &&
        s.ins != -1 &&
        (s.endB == s.b ? s.b >= from && s.b <= to : s.b < to && s.endB > from)
    ),
  pointMapper: (changes: readonly number[], pos: number) =>
    walk(changes)
      .filter((s) => s.endA >= pos && s.a <= pos)
      .flatMap((s) =>
        s.ins < 0
          ? [s.b + pos - s.a]
          : [...(pos == s.a ? [s.b] : []), ...(pos == s.endA ? [s.b + s.ins] : [])]
      ),
};

describe("samePlace", () => {
  // The second paragraph's content starts at 5.
  it("keeps a plot in its place through an insertion at the start of its content", () => {
    expect(samePlace([5, -1, 0, 1, 11, -1], 5, 5)).toBe(true);
  });

  it("follows a plot moved by an insertion before it", () => {
    expect(samePlace([3, -1, 0, 2, 13, -1], 5, 7)).toBe(true);
    expect(samePlace([3, -1, 0, 2, 13, -1], 5, 5)).toBe(false);
  });

  it("keeps a plot whose opening token was replaced by one (a parameter changed)", () => {
    expect(samePlace([4, -1, 1, 1, 11, -1], 5, 5)).toBe(true);
  });

  it("loses a plot whose opening token went with more", () => {
    expect(samePlace([4, -1, 2, 1, 10, -1], 5, 5)).toBe(false);
  });
});

describe("change section helpers", () => {
  it("answer as walking the sections does", () => {
    let seed = 1;
    const random = (n: number) => {
      seed = (seed * 16807) % 2147483647;
      return seed % n;
    };
    for (let run = 0; run < 300; run++) {
      const changes: number[] = [];
      for (let i = random(8); i >= 0; i--)
        changes.push(random(5), [-1, -2, 0, 1, 2, 3][random(6)] ?? -1);
      const size = changes.reduce((sum, n, i) => (i % 2 ? sum : sum + n), 0);
      for (let pos = 0; pos <= size + 1; pos++) {
        for (const leaf of [false, true])
          expect(mapNodePos(changes, pos, leaf)).toEqual(reference.mapNodePos(changes, pos, leaf));
        expect(mapKept(changes, pos)).toEqual(reference.mapKept(changes, pos));
        expect(redrawn(changes, pos)).toBe(reference.redrawn(changes, pos));
        expect(pointMapper(changes)(pos)).toEqual(reference.pointMapper(changes, pos));
        for (let to = pos; to <= size + 1; to++)
          expect(isKept(changes, pos, to)).toBe(reference.isKept(changes, pos, to));
      }
    }
  });
});
