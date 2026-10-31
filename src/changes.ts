// Named after Wordgard's editor/changes.ts: helpers over the change sections
// DocTile.update receives, pairs of a length in the old document and -1 (kept),
// -2 (redrawn: marks or decorations changed) or the length that replaced it.
import type { Plot } from "wordgard/doc";

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
  let first = Infinity;
  let last = -Infinity;
  for (let i = 0, posA = 0; i < changes.length; i += 2) {
    const len = changes[i] ?? 0;
    if (changes[i + 1] != -1) {
      first = Math.min(first, posA);
      last = posA + len;
    }
    posA += len;
  }
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
