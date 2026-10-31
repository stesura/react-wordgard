// Times load, a keystroke and formatting the whole document (Ctrl+A, bold), and
// measures the memory the loaded editor holds, in the editors of editors.ts.
// `npm run bench` (React's production build), `npm run bench:dev`,
// `npm run bench:smoke` (small documents, to check it runs; `--mode
// smoke-development` for the development build).
import React from "react";

import {
  type Mount,
  editors,
  heap,
  mountPoint,
  paragraphs,
  reactBuild,
  settle,
  sizes,
  smoke,
  timings,
} from "./editors.js";

const keystrokes = smoke ? 5 : 30;
const warmup = smoke ? 1 : 5;
const formats = smoke ? 2 : 4;
// Chromium gives a page at most 4 GB of heap. react-prosemirror holds about
// 2 GB at 15,000 paragraphs with inline nodes, and formatting all of them
// then crashes the page: an editor holding more than this skips the format.
const formatLimit = 1000;

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
};

// Until the DOM is updated and laid out: Wordgard's flush measures layout,
// ProseMirror leaves it to the browser, so it's forced for every editor.
const time = (parent: HTMLElement, f: () => void) => {
  const start = performance.now();
  f();
  parent.getBoundingClientRect();
  return performance.now() - start;
};

// In its own function: a suspended async function keeps its locals, so the
// test's loop would hold the last editor while the next is measured.
const measure = async (mount: Mount, html: string, n: number) => {
  const parent = mountPoint();
  const before = heap();
  const editor = await mount(html, n, parent);
  const load = timings.load;
  const memory = heap() - before;
  const typed: number[] = [];
  for (let i = 0; i < warmup + keystrokes; i++) {
    const ms = time(parent, () => editor.type(i));
    if (i >= warmup) typed.push(ms);
  }
  const formatted: number[] = [];
  if (memory < formatLimit)
    for (let i = 0; i < formats; i++) formatted.push(time(parent, () => editor.format(i % 2 == 0)));
  // The editor drew the document and what was typed.
  const drawn = parent.querySelectorAll("p");
  expect(drawn.length).toBe(n);
  expect(parent.querySelectorAll("img[src]").length).toBe(html.includes("<img") ? n : 0);
  expect(drawn[Math.floor(n / 2)]?.textContent).toContain("x".repeat(warmup + keystrokes));
  editor.destroy();
  parent.remove();
  await settle();
  return { load, typed, formatted, memory };
};

it("times the editors", async () => {
  const build = reactBuild();
  const rows: string[] = [];
  for (const [docName, html] of Object.entries(paragraphs))
    for (const n of sizes)
      for (const [name, mount] of editors) {
        const { load, typed, formatted, memory } = await measure(mount, html, n);
        const row = `| ${docName} | ${n} | ${name} | ${load.toFixed(0)} | ${median(typed).toFixed(1)} | ${formatted.length ? median(formatted).toFixed(0) : `skipped (> ${formatLimit} MB held)`} | ${memory.toFixed(0)} |`;
        rows.push(row);
        // As it goes, so a crash keeps the rows before it.
        // eslint-disable-next-line no-console
        console.log(row);
      }
  // The benchmark's output.
  // eslint-disable-next-line no-console
  console.log(
    [
      `React ${React.version}, ${build} build, ${navigator.userAgent}`,
      `Medians: ${keystrokes} keystrokes after ${warmup} unmeasured, ${formats} whole-document format changes (bold on, off). Memory: the heap the loaded editor holds, after garbage collection, give or take a few tens of MB (small negative values mean about nothing).`,
      "",
      "| Document | Paragraphs | Editor | Load (ms) | Keystroke (ms) | Format all (ms) | Memory (MB) |",
      "|---|---|---|---|---|---|---|",
      ...rows,
    ].join("\n")
  );
});
