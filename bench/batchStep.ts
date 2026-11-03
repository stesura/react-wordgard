// Stesura's batch step, adapted from Stesura's
// packages/core/src/helpers/core/batch-step.ts (2026-11-03): many ordinary
// steps applied as one, so a bulk edit copies the document's wide child arrays
// once instead of once per step. Kept: what applying, mapping and inverting it
// needs. Dropped: JSON parsing and Stesura's collab helpers (fit, mapInner,
// registration, rangesOf). It is Stesura's, not ProseMirror's: the benchmark
// shows it as the best ProseMirror can do with a custom step.
//
// Licence: Stesura's core is proprietary (© Innov-Ars, all rights reserved),
// not MIT like this repository. Not to be published until its owner decides.
import type { Mark, Node } from "prosemirror-model";
import type { Mappable } from "prosemirror-transform";

import { Fragment } from "prosemirror-model";
import {
  AddMarkStep,
  AttrStep,
  RemoveMarkStep,
  ReplaceStep,
  Step,
  StepMap,
  StepResult,
} from "prosemirror-transform";

const STEP_TYPE = "batch";

/**
 * The step kinds a batch holds.
 */
export type InnerStep = AddMarkStep | RemoveMarkStep | AttrStep | ReplaceStep;

/**
 * A position range in the document a step applies to.
 */
export type StepRange = { from: number; to: number };

/**
 * Many ordinary steps applied as one (docs/partially-executed/bulk-steps-plan.md, Part B): a bulk
 * edit over thousands of textblocks copies the document's wide child arrays once instead of once
 * per step, and travels as one step.
 *
 * It means its sequential expansion: `steps` applied in order, each to the result of the ones
 * before. The constructor checks two rules that make every inner step's positions hold in the
 * document before the batch too, so it can be applied, inverted and read in one pass:
 * - **position-stable:** a step lies at or before every replace that precedes it, a replace
 *   strictly before (descending positions, replaces not touching);
 * - **disjoint replaces:** no other step reaches inside a replace's range.
 *
 * `apply` rebuilds each touched textblock once, then the tree once along the touched paths, the
 * other nodes kept as they are. A step outside that fast path (a range across a block boundary
 * after mapping, an attr on a node that isn't in a textblock) applies on its own, in sequence, with
 * the same result.
 *
 * Read a batch through `standardStepsOf`, never by class. Inner positions are in the batch's
 * before-doc (`tr.docs[i]`); a position after it maps through the batch's own `getMap()`.
 */
export class BatchStep extends Step {
  private map_: StepMap | null = null;

  constructor(readonly steps: readonly InnerStep[]) {
    super();
    if (steps.length === 0) throw new RangeError("A batch step holds at least one step");
    const order = stabilityChecker();
    for (const step of steps) {
      if (!isInnerStep(step))
        throw new RangeError("A batch step holds mark, attr and replace steps only");
      if (!order.accepts(step))
        throw new RangeError("A batch step's steps must be position-stable");
      order.add(step);
    }
    if (!replacesDisjoint(steps))
      throw new RangeError("A batch step's replaces must not overlap its other steps");
  }

  /**
   * Runs of steps on the fast path in one pass each, a step off it on its own: one straddling
   * step (a concurrent split inside a bulk edit) costs one sequential step, not the whole batch.
   */
  apply(doc: Node): StepResult {
    let current = doc;
    let blocks = textblocksOf(doc);
    // Whether `blocks` are `current`'s: refreshed only when a run is about to use them.
    let fresh = true;
    let i = 0;
    while (i < this.steps.length) {
      if (placeOps(this.steps[i]!, blocks)) {
        if (!fresh) {
          blocks = textblocksOf(current);
          fresh = true;
          continue;
        }
        const perBlock = new Map<Block, BlockOp[]>();
        for (; i < this.steps.length; i++) {
          const placed = placeOps(this.steps[i]!, blocks);
          if (!placed) break;
          for (const { block, op } of placed) {
            let list = perBlock.get(block);
            if (!list) perBlock.set(block, (list = []));
            list.push(op);
          }
        }
        const result = applyRun(current, perBlock);
        if (!result.doc) return result;
        current = result.doc;
      } else {
        const result = this.steps[i++]!.apply(current);
        if (!result.doc) return result;
        current = result.doc;
      }
      fresh = false;
    }
    return StepResult.ok(current);
  }

  /** The replaces' ranges, ascending: equal to their sequential maps, given the rules above. */
  getMap(): StepMap {
    if (this.map_) return this.map_;
    const ranges: number[] = [];
    for (let i = this.steps.length - 1; i >= 0; i--) {
      const step = this.steps[i]!;
      if (step instanceof ReplaceStep) ranges.push(step.from, step.to - step.from, step.slice.size);
    }
    if (!ranges.length) return (this.map_ = StepMap.empty);
    return (this.map_ =
      ranges.length > 3 * FEW_RANGES ? new SearchedStepMap(ranges) : new StepMap(ranges));
  }

  /**
   * Each inner step's inverse, read off `doc` (the rules make the before-doc right for each of
   * them) and placed in the after-doc through the batch's own map: the other steps' inverses
   * first, in reverse order, then the replaces', descending.
   */
  invert(doc: Node): BatchStep {
    const blocks = textblocksOf(doc);
    const after = afterPositions(this.steps);
    const others: InnerStep[] = [];
    const replaces: InnerStep[] = [];
    for (const step of this.steps) {
      if (step instanceof ReplaceStep) {
        const from = after(step.from, -1);
        replaces.push(
          new ReplaceStep(from, from + step.slice.size, sliceOf(doc, blocks, step.from, step.to))
        );
      } else if (step instanceof AttrStep) {
        const node = nodeAt(doc, blocks, step.pos);
        if (!node) throw new RangeError("No node at an inner attr step's position");
        others.push(new AttrStep(after(step.pos, 1), step.attr, node.attrs[step.attr]));
      } else {
        const from = after(step.from, 1);
        const to = after(step.to, -1);
        others.push(
          step instanceof AddMarkStep
            ? new RemoveMarkStep(from, to, step.mark)
            : new AddMarkStep(from, to, step.mark)
        );
      }
    }
    return new BatchStep([...others.reverse(), ...replaces]);
  }

  /**
   * Each inner step mapped by its own class. Those that fail, or that the mapping would put out of
   * order (a concurrent deletion making two replaces touch), are dropped; null when none is left.
   */
  map(mapping: Mappable): BatchStep | null {
    const order = stabilityChecker();
    const kept: InnerStep[] = [];
    for (const step of this.steps) {
      const mapped = step.map(mapping);
      if (!mapped || !isInnerStep(mapped) || !order.accepts(mapped)) continue;
      order.add(mapped);
      kept.push(mapped);
    }
    return kept.length ? new BatchStep(kept) : null;
  }

  /** Mark steps as rows over a table of their marks: each would carry its whole mark otherwise. */
  toJSON() {
    const marks: unknown[] = [];
    const index = new Map<string, number>();
    const markIndex = (mark: Mark) => {
      const json = mark.toJSON();
      const key = JSON.stringify(json);
      let i = index.get(key);
      if (i === undefined) {
        index.set(key, (i = marks.length));
        marks.push(json);
      }
      return i;
    };
    const steps = this.steps.map((step) => {
      if (step instanceof AddMarkStep) return [ADD, step.from, step.to, markIndex(step.mark)];
      if (step instanceof RemoveMarkStep) return [REMOVE, step.from, step.to, markIndex(step.mark)];
      return step.toJSON();
    });
    return { stepType: STEP_TYPE, marks, steps };
  }
}

const ADD = 0;
const REMOVE = 1;

const isInnerStep = (step: Step): step is InnerStep =>
  step instanceof AddMarkStep ||
  step instanceof RemoveMarkStep ||
  step instanceof AttrStep ||
  step instanceof ReplaceStep;

/** The positions an inner step reads and writes. */
const rangeOf = (step: InnerStep): StepRange =>
  step instanceof AttrStep
    ? { from: step.pos, to: step.pos + 1 }
    : { from: step.from, to: step.to };

/**
 * Checks the position-stable rule one step at a time. Replaces don't even touch: where one ends at
 * another's start, its inverse or itself could be a pure insertion at that boundary, which one map
 * can't order (a producer merges adjacent replaces into one).
 */
const stabilityChecker = () => {
  let floor = Infinity;
  return {
    accepts: (step: InnerStep): boolean => {
      const { to } = rangeOf(step);
      return step instanceof ReplaceStep ? to < floor : to <= floor;
    },
    add: (step: InnerStep) => {
      if (step instanceof ReplaceStep && step.from < floor) floor = step.from;
    },
  };
};

/** Whether no non-replace step reaches inside a replace's range (or across a pure insertion). */
const replacesDisjoint = (steps: readonly InnerStep[]): boolean => {
  const replaces: StepRange[] = [];
  for (const step of steps) if (step instanceof ReplaceStep) replaces.push(rangeOf(step));
  if (!replaces.length) return true;
  // Position-stable replaces never overlap each other, so `to` ascends with `from`.
  replaces.sort((a, b) => a.from - b.from);
  for (const step of steps) {
    if (step instanceof ReplaceStep) continue;
    const { from, to } = rangeOf(step);
    // The first replace ending after `from`: the only one that can reach into [from, to).
    let lo = 0;
    let hi = replaces.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (replaces[mid]!.to > from) hi = mid;
      else lo = mid + 1;
    }
    const replace = replaces[lo];
    if (!replace) continue;
    const overlaps =
      replace.from === replace.to ? from < replace.from && replace.from < to : replace.from < to;
    if (overlaps) return false;
  }
  return true;
};

/**
 * Before-doc positions mapped into the after-doc, through the replaces' size changes below them:
 * `getMap()`'s mapping, by binary search instead of a scan over every range.
 */
const afterPositions = (steps: readonly InnerStep[]) => {
  const replaces = steps
    .filter((step) => step instanceof ReplaceStep)
    .sort((a, b) => a.from - b.from);
  const shiftBefore: number[] = [];
  let shift = 0;
  for (const replace of replaces) {
    shiftBefore.push(shift);
    shift += replace.slice.size - (replace.to - replace.from);
  }
  return (pos: number, assoc: 1 | -1): number => {
    // The last replace starting at or before `pos`.
    let lo = -1;
    let hi = replaces.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (replaces[mid]!.from <= pos) lo = mid;
      else hi = mid - 1;
    }
    if (lo < 0) return pos;
    const replace = replaces[lo]!;
    const before = shiftBefore[lo]!;
    if (pos > replace.to) return pos + before + replace.slice.size - (replace.to - replace.from);
    // At its edge or inside: the start side unless past its start, as `StepMap` decides.
    const side =
      replace.from === replace.to
        ? assoc
        : pos === replace.from
          ? -1
          : pos === replace.to
            ? 1
            : assoc;
    return replace.from + before + (side < 0 ? 0 : replace.slice.size);
  };
};

/** Ranges a `StepMap` scans faster than it binary-searches them. */
const FEW_RANGES = 8;

/**
 * A batch's map, which holds a range per inner replace: `StepMap.map` scans the ranges below a
 * position, so mapping each of a Replace All's decorations or inner positions through it costs
 * ranges × positions. This one finds the range by binary search and maps as `StepMap` does
 * (ascending ranges, none overlapping). `mapResult` stays `StepMap`'s: its recovery index is
 * what a rebase's mirrored maps read.
 */
class SearchedStepMap extends StepMap {
  private readonly starts: number[] = [];
  private readonly ends: number[] = [];
  private readonly sizes: number[] = [];
  /** The size change of the ranges before each one, and of all of them last. */
  private readonly shifts: number[] = [0];

  constructor(ranges: readonly number[]) {
    super(ranges);
    for (let i = 0; i < ranges.length; i += 3) {
      const start = ranges[i]!;
      const oldSize = ranges[i + 1]!;
      const newSize = ranges[i + 2]!;
      this.starts.push(start);
      this.ends.push(start + oldSize);
      this.sizes.push(newSize);
      this.shifts.push(this.shifts.at(-1)! + newSize - oldSize);
    }
  }

  map(pos: number, assoc = 1): number {
    // The first range ending at or after `pos`: the one `StepMap`'s scan would stop at.
    let lo = 0;
    let hi = this.ends.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.ends[mid]! < pos) lo = mid + 1;
      else hi = mid;
    }
    const shift = this.shifts[lo]!;
    const start = this.starts[lo];
    if (start === undefined || start > pos) return pos + shift;
    const end = this.ends[lo]!;
    const side = start === end ? assoc : pos === start ? -1 : pos === end ? 1 : assoc;
    return start + shift + (side < 0 ? 0 : this.sizes[lo]!);
  }
  /**
   * The same ranges seen from the after-doc, as a forward map: what `StepMap.invert` maps, binary
   * searched too (an undo or a rebase maps through a Replace All's inverse). Its recovery indexes
   * and positions are the inverted map's.
   */
  invert(): StepMap {
    const ranges: number[] = [];
    this.starts.forEach((start, i) =>
      ranges.push(start + this.shifts[i]!, this.sizes[i]!, this.ends[i]! - start)
    );
    return new SearchedStepMap(ranges);
  }
}

// --- One pass ---------------------------------------------------------------------------------

type Block = { before: number; start: number; end: number; node: Node };

/** The textblocks of `doc` in document order, their inline content not walked. */
const textblocksOf = (doc: Node): Block[] => {
  const blocks: Block[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    blocks.push({ before: pos, start: pos + 1, end: pos + 1 + node.content.size, node });
    return false;
  });
  return blocks;
};

/** The textblock holding `pos` (its opening token included), or undefined. */
const blockAt = (blocks: readonly Block[], pos: number): Block | undefined => {
  let lo = 0;
  let hi = blocks.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (blocks[mid]!.before <= pos) lo = mid;
    else hi = mid - 1;
  }
  const block = blocks[lo];
  return block && block.before <= pos && pos <= block.end ? block : undefined;
};

/** `doc.nodeAt(pos)`, through the block list where it can: a linear scan of a wide parent otherwise. */
const nodeAt = (doc: Node, blocks: readonly Block[], pos: number): Node | null => {
  const block = blockAt(blocks, pos);
  if (block?.before === pos) return block.node;
  if (block && pos >= block.start) return block.node.nodeAt(pos - block.start);
  return doc.nodeAt(pos);
};

const sliceOf = (doc: Node, blocks: readonly Block[], from: number, to: number) => {
  const block = blockAt(blocks, from);
  if (block && from >= block.start && to <= block.end)
    return block.node.slice(from - block.start, to - block.start);
  return doc.slice(from, to);
};

/** `step` moved by `by`, or null for a kind the fast path doesn't take. */
const shift = (step: InnerStep, by: number): Step | null => {
  if (step instanceof AddMarkStep) return new AddMarkStep(step.from + by, step.to + by, step.mark);
  if (step instanceof RemoveMarkStep)
    return new RemoveMarkStep(step.from + by, step.to + by, step.mark);
  if (step instanceof AttrStep) return new AttrStep(step.pos + by, step.attr, step.value);
  // An open slice reaches out of the block (the inverse of a replace that a concurrent split made
  // straddle two blocks). `structure` isn't public; a structure replace is a join's.
  if (step.slice.openStart || step.slice.openEnd || step.toJSON().structure) return null;
  return new ReplaceStep(step.from + by, step.to + by, step.slice);
};

/** A step addressed to one textblock: shifted into its content, or an attr on the block itself. */
type BlockOp = { step: Step } | { attr: string; value: unknown };

/** The textblock `step` sits in and its op there, or null when it's off the fast path. */
const placeOp = (
  step: InnerStep,
  blocks: readonly Block[]
): { block: Block; op: BlockOp } | null => {
  const { from, to } = rangeOf(step);
  const block = blockAt(blocks, from);
  if (!block) return null;
  if (step instanceof AttrStep && step.pos === block.before) {
    return { block, op: { attr: step.attr, value: step.value } };
  }
  if (from < block.start || to > block.end) return null;
  const shifted = shift(step, -block.start);
  return shifted && { block, op: { step: shifted } };
};

/** The index of the first block whose content ends after `pos`. */
const firstEndingAfter = (blocks: readonly Block[], pos: number): number => {
  let lo = 0;
  let hi = blocks.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (blocks[mid]!.end > pos) hi = mid;
    else lo = mid + 1;
  }
  return lo;
};

/**
 * {@link placeOp}, plus a mark step spanning textblocks (merged across paragraphs,
 * docs/partially-executed/text-style-steps-plan.md P1.2) as one op per block it reaches: all inline content lies in
 * textblocks, so the parts mark what the step does. Null when off the fast path.
 */
const placeOps = (
  step: InnerStep,
  blocks: readonly Block[]
): { block: Block; op: BlockOp }[] | null => {
  const one = placeOp(step, blocks);
  if (one) return [one];
  if (!(step instanceof AddMarkStep || step instanceof RemoveMarkStep)) return null;
  const parts: { block: Block; op: BlockOp }[] = [];
  for (
    let i = firstEndingAfter(blocks, step.from);
    i < blocks.length && blocks[i]!.start < step.to;
    i++
  ) {
    const block = blocks[i]!;
    const from = Math.max(step.from, block.start) - block.start;
    const to = Math.min(step.to, block.end) - block.start;
    if (from >= to) continue;
    parts.push({
      block,
      op: {
        step:
          step instanceof AddMarkStep
            ? new AddMarkStep(from, to, step.mark)
            : new RemoveMarkStep(from, to, step.mark),
      },
    });
  }
  return parts;
};

/** A run of placed steps applied: each touched textblock rebuilt once, then the tree. */
const applyRun = (doc: Node, perBlock: ReadonlyMap<Block, readonly BlockOp[]>): StepResult => {
  const replaced = new Map<number, Node>();
  for (const [block, ops] of perBlock) {
    let node = block.node;
    for (const op of ops) {
      if ("attr" in op) {
        node = node.type.create({ ...node.attrs, [op.attr]: op.value }, node.content, node.marks);
        continue;
      }
      const result = op.step.apply(node);
      if (!result.doc) return result;
      node = result.doc;
    }
    replaced.set(block.before, node);
  }
  return StepResult.ok(rebuild(doc, replaced));
};

/** `doc` with the textblocks at `replaced`'s positions swapped in, copying only their ancestors. */
const rebuild = (doc: Node, replaced: ReadonlyMap<number, Node>): Node => {
  const keys = [...replaced.keys()].sort((a, b) => a - b);
  const walk = (node: Node, contentStart: number, lo: number, hi: number): Node => {
    const children: Node[] = [];
    let pos = contentStart;
    let k = lo;
    node.forEach((child) => {
      const end = pos + child.nodeSize;
      if (k < hi && keys[k]! < end) {
        let kEnd = k;
        while (kEnd < hi && keys[kEnd]! < end) kEnd++;
        children.push(child.isTextblock ? replaced.get(pos)! : walk(child, pos + 1, k, kEnd));
        k = kEnd;
      } else {
        children.push(child);
      }
      pos = end;
    });
    return node.copy(Fragment.fromArray(children));
  };
  return walk(doc, 0, 0, keys.length);
};
