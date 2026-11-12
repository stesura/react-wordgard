// Named after Wordgard's editor/changes.ts: helpers over the change sections DocTile.update gets,
// pairs of an old length and -1 (kept), -2 (redrawn) or the new length. An update can have a
// section per node, so they search an index built once per update rather than walk them.
import type { Plot } from "wordgard/doc";

type Index = {
  // Per section: where it starts and ends in the old document and the new.
  startA: number[];
  endA: number[];
  startB: number[];
  endB: number[];
  ins: number[];
  // Where the first section not kept starts and the last ends, in the old
  // document.
  first: number;
  last: number;
};

const indexes = new WeakMap<readonly number[], Index>();

const indexOf = (changes: readonly number[]) => {
  const found = indexes.get(changes);
  if (found) return found;
  const index: Index = {
    startA: [],
    endA: [],
    startB: [],
    endB: [],
    ins: [],
    first: Infinity,
    last: -Infinity,
  };
  for (let i = 0, posA = 0, posB = 0; i < changes.length; i += 2) {
    const len = changes[i] ?? 0;
    const ins = changes[i + 1] ?? 0;
    const endB = posB + (ins < 0 ? len : ins);
    index.startA.push(posA);
    index.endA.push(posA + len);
    index.startB.push(posB);
    index.endB.push(endB);
    index.ins.push(ins);
    if (ins != -1) {
      index.first = Math.min(index.first, posA);
      index.last = posA + len;
    }
    posA += len;
    posB = endB;
  }
  indexes.set(changes, index);
  return index;
};

// The first section whose end (`ends` is ascending) is past `pos`, or reaches
// it when `inclusive`; the section count when none is.
const sectionAt = (ends: readonly number[], pos: number, inclusive = false) => {
  let low = 0;
  let high = ends.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    const end = ends[mid] ?? 0;
    if (inclusive ? end >= pos : end > pos) high = mid;
    else low = mid + 1;
  }
  return low;
};

// Wordgard's ChangeSet.mapPos with assoc 1 and track "after": where the node
// starting at `pos` went, or null when its first token was replaced.
// `retagged` marks a replacement of that token alone, by one token (a tag or
// parameter change), which keeps the key when the node type stays the same. A
// leaf is its token, and Wordgard's update merges adjacent replaced sections:
// a leaf in a replaced section of unchanged length is retagged, at the same
// offset in it. A copy, since `update` gets bare sections and Wordgard can't
// map over those.
export const mapNodePos = (changes: readonly number[], pos: number, leaf = false) => {
  const { startA, endA, startB, endB, ins } = indexOf(changes);
  const k = sectionAt(endA, pos);
  const fromA = startA[k] ?? 0;
  const fromB = startB[k] ?? 0;
  if (k == endA.length) {
    const totalA = endA.at(-1) ?? 0;
    return { pos: (endB.at(-1) ?? 0) + pos - totalA, retagged: false };
  }
  if ((ins[k] ?? 0) < 0) return { pos: fromB + pos - fromA, retagged: false };
  const lenA = (endA[k] ?? 0) - fromA;
  if (leaf && lenA == ins[k]) return { pos: fromB + pos - fromA, retagged: true };
  return fromA == pos && lenA == 1 && ins[k] == 1 ? { pos: fromB, retagged: true } : null;
};

// Where `pos` in the old document went, or null when it was replaced.
export const mapKept = (changes: readonly number[], pos: number) => {
  const { startA, endA, startB, ins } = indexOf(changes);
  const k = sectionAt(endA, pos);
  if (k == endA.length || (ins[k] ?? 0) >= 0) return null;
  return (startB[k] ?? 0) + pos - (startA[k] ?? 0);
};

// Whether a plot's content, which started at `oldStart`, starts at `start`
// now, the plot kept in its place: mapped through its opening token (the doc
// has none, and starts at 0), kept or replaced by one (a parameter changed),
// as its key is, so an insertion at the start of the content doesn't count as
// a move.
export const samePlace = (changes: readonly number[], oldStart: number, start: number) =>
  oldStart == 0 ? start == 0 : mapNodePos(changes, oldStart - 1)?.pos == start - 1;

// Whether the token at `pos` in the new document is in a range the update
// redraws or replaces.
export const redrawn = (changes: readonly number[] | null, pos: number) => {
  if (!changes) return false;
  const { endB, ins } = indexOf(changes);
  const k = sectionAt(endB, pos);
  return k < endB.length && ins[k] != -1;
};

// Whether [from, to] in the new document lies in kept sections only, touching
// no other (zero-length ones included).
export const isKept = (changes: readonly number[] | null, from: number, to: number) => {
  if (!changes) return false;
  const { startB, endB, ins } = indexOf(changes);
  for (let k = sectionAt(endB, from, true); k < endB.length; k++) {
    const start = startB[k] ?? 0;
    const end = endB[k] ?? 0;
    if (start > to) break;
    if (ins[k] != -1 && (end == start ? start >= from && start <= to : start < to && end > from))
      return false;
  }
  return true;
};

// Where an old position is in the new document, for Wordgard's update to look
// for old widgets there (TilePointer.matchingWidget): along kept and redrawn
// ranges, and at both edges of a replaced one, which meet in the old document
// when it's an insertion. Nowhere inside one.
export const pointMapper = (changes: readonly number[]) => {
  const { startA, endA, startB, ins } = indexOf(changes);
  return (pos: number) => {
    const found: number[] = [];
    for (let k = sectionAt(endA, pos, true); k < endA.length; k++) {
      const a = startA[k] ?? 0;
      if (a > pos) break;
      const b = startB[k] ?? 0;
      const inserted = ins[k] ?? 0;
      if (inserted < 0) found.push(b + pos - a);
      else {
        if (pos == a) found.push(b);
        if (pos == (endA[k] ?? 0)) found.push(b + inserted);
      }
    }
    return found;
  };
};

// How many of a plot's first and last children an update leaves alone: the
// same node objects, wholly outside the ranges it redraws or replaces, without
// touching one (zero-length ones included). `oldStart` is where the old plot's
// content started. Laying out, keying and checking a re-laid plot then only
// need its middle.
export const unchangedEnds = (
  changes: readonly number[],
  oldPlot: Plot,
  oldStart: number,
  plot: Plot
) => {
  const { first, last } = indexOf(changes);
  const before = oldPlot.content;
  const after = plot.content;
  const both = Math.min(before.length, after.length);
  let head = 0;
  for (let pos = oldStart; head < both; head++) {
    const child = before[head];
    if (!child || child !== after[head] || pos + child.length >= first) break;
    pos += child.length;
  }
  let tail = 0;
  for (let pos = oldStart + oldPlot.contentLength; tail < both - head; tail++) {
    const child = before[before.length - 1 - tail];
    if (!child || child !== after[after.length - 1 - tail] || pos - child.length <= last) break;
    pos -= child.length;
  }
  return { head, tail };
};
