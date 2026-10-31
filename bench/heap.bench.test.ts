// What each loaded editor holds in the heap, by class: heap snapshots before
// and after mounting, diffed (heapSnapshot.ts). `npm run bench:heap`
// (React's production build), `npm run bench:heap-dev`; `--mode heap-smoke`
// for small documents.
import React, { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { commands } from "vitest/browser";

import {
  type Mount,
  editors,
  heap,
  mountPoint,
  paragraphs,
  reactBuild,
  settle,
  sizes,
} from "./editors.js";
import type { HeapCounts } from "./heapSnapshot.js";

declare module "vitest/browser" {
  interface BrowserCommands {
    heapBaseline: () => Promise<void>;
    heapHeld: () => Promise<HeapCounts>;
  }
}

// Snapshots need memory on top of the heap, and the page doesn't get all of it
// back: after snapshotting react-prosemirror at 15,000 paragraphs (700 MB), the
// page crashed later in the run. An editor holding more than this many MB is
// skipped; its make-up at 2,500 paragraphs scales linearly.
const snapshotLimit = 500;
// The classes listed: each editor's largest.
const top = 12;

const total = (counts: HeapCounts, native: boolean) => {
  const sum = { count: 0, size: 0 };
  for (const [key, { count, size }] of Object.entries(counts))
    if (key.startsWith("native ") == native) {
      sum.count += count;
      sum.size += size;
    }
  return sum;
};

// React's production build is minified: its fiber class's name, to label it.
const fiberClass = () => {
  const parent = document.createElement("div");
  const root = createRoot(parent);
  flushSync(() => root.render(createElement("span")));
  const span = parent.firstChild;
  const key = span && Object.keys(span).find((key) => key.startsWith("__reactFiber$"));
  const name: unknown = key && Reflect.get(Reflect.get(span, key), "constructor")?.name;
  root.unmount();
  return typeof name == "string" ? name : null;
};

const cell = ({ count, size }: { count: number; size: number }) =>
  `${count.toLocaleString("en-US")} · ${(size / 1e6).toFixed(1)} MB`;

// In its own function: a suspended async function keeps its locals, so the
// test's loop would hold the last editor while the next is measured.
const measure = async (mount: Mount, html: string, n: number) => {
  await commands.heapBaseline();
  const parent = mountPoint();
  const start = heap();
  const editor = await mount(html, n, parent);
  const held = heap() - start > snapshotLimit ? null : await commands.heapHeld();
  expect(parent.querySelectorAll("p").length).toBe(n);
  editor.destroy();
  parent.remove();
  await settle();
  return held;
};

it("snapshots the editors' heaps", async () => {
  const build = reactBuild();
  const fiber = fiberClass();
  await settle();
  const label = (key: string) =>
    (key == fiber ? `${key} (React's FiberNode)` : key).replaceAll("|", "\\|");
  const tables: string[] = [];
  // MB of JS heap per paragraph, by document and editor.
  const projected = new Map<string, number>();
  // A first mount compiles each editor's code: done here, so it isn't counted.
  for (const html of Object.values(paragraphs))
    for (const [, mount] of editors) await measure(mount, html, 20);
  for (const [docName, html] of Object.entries(paragraphs))
    for (const n of sizes) {
      const held = new Map<string, HeapCounts | null>();
      for (const [name, mount] of editors) {
        // Not even mounted when a smaller document predicts it's over the limit.
        const perParagraph = projected.get(`${docName}/${name}`) ?? 0;
        if (perParagraph * n > snapshotLimit) {
          held.set(name, null);
          continue;
        }
        const counts = await measure(mount, html, n);
        held.set(name, counts);
        if (counts) projected.set(`${docName}/${name}`, total(counts, false).size / 1e6 / n);
      }
      const keys = new Set<string>();
      for (const counts of held.values())
        if (counts)
          for (const [key] of Object.entries(counts)
            .filter(([key]) => !key.startsWith("native "))
            .sort(([, a], [, b]) => b.size - a.size)
            .slice(0, top))
            keys.add(key);
      const largest = (key: string) =>
        Math.max(...[...held.values()].map((counts) => counts?.[key]?.size ?? 0));
      const row = (label: string, f: (counts: HeapCounts) => { count: number; size: number }) =>
        `| ${label} | ${[...held.values()].map((counts) => (counts ? cell(f(counts)) : `skipped (> ${snapshotLimit} MB)`)).join(" | ")} |`;
      const table = [
        `${docName}, ${n} paragraphs: objects held · their own size`,
        "",
        `| Class | ${[...held.keys()].join(" | ")} |`,
        `|---|${[...held.keys()].map(() => "---|").join("")}`,
        row("**JS total**", (counts) => total(counts, false)),
        row("**DOM (native) total**", (counts) => total(counts, true)),
        ...[...keys]
          .sort((a, b) => largest(b) - largest(a))
          .map((key) => row(label(key), (counts) => counts[key] ?? { count: 0, size: 0 })),
      ].join("\n");
      tables.push(table);
      // As it goes, so a crash keeps the tables before it.
      // eslint-disable-next-line no-console
      console.log(table);
    }
  // The benchmark's output.
  // eslint-disable-next-line no-console
  console.log(
    [
      `React ${React.version}, ${build} build, ${navigator.userAgent}`,
      `Heap snapshots before and after mounting, diffed: the objects each loaded editor holds, document included, by class (constructor name; strings, code and closures by type). Sizes are objects' own (shallow) sizes, not what they retain. Each editor's ${top} largest classes are listed.`,
      "",
      ...tables.flatMap((table) => [table, ""]),
    ].join("\n")
  );
});
