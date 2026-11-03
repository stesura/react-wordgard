// Times the editors of editors.ts on the documents of documents.ts: load, the
// first keystroke, typing, Enter and bolding the whole document, with what a
// keystroke and an Enter allocate; then bulk edits over every paragraph (an
// indent, a Replace All, setting the font size of styled text), dispatched as
// one transaction, in chunks and as Stesura's batch step, with their
// transactions, steps, documents built, memory and undo. All of it twice:
// without plugins, then with the stand-in plugins of plugins.ts (bulk edits as
// one transaction and as the batch step only).
// `npm run bench` (React's production build), `npm run bench:dev`,
// `npm run bench:smoke` (50 paragraphs, one run, to check it runs).
import React from "react";
import { commands } from "vitest/browser";

import {
  type Bulk,
  type Mount,
  type Variant,
  chunkSize,
  documentHTML,
  editors,
  fontSize,
  heap,
  heapNow,
  mountPoint,
  reactBuild,
  settle,
  sizes,
  smoke,
  styledHTML,
  timings,
} from "./editors.js";
import { replacement } from "./documents.js";

declare module "vitest/browser" {
  interface BrowserCommands {
    allocationsStart: () => Promise<void>;
    allocationsStop: () => Promise<number>;
  }
}

const runs = smoke ? 1 : 3;
const keystrokes = smoke ? 5 : 30;
const enters = smoke ? 3 : 10;
const warmup = smoke ? 1 : 5;
const formats = smoke ? 2 : 4;
// Chromium gives a page at most 4 GB of heap: an editor holding more than this
// many MB after load skips bolding everything, which could crash the page.
const formatLimit = 1000;
// A bulk edit projected (from the previous size, squared) to take longer than
// this many ms, or to leave more than this many MB on the heap before garbage
// collection, is skipped.
const timeLimit = 180_000;
const memoryLimit = 2000;

const kinds: Bulk[] = ["indent", "replace", "fontSize"];
const casesOf = (variants: Variant[]) =>
  kinds.flatMap((kind) => variants.map((variant): [Bulk, Variant] => [kind, variant]));
const titles: Record<Bulk, string> = {
  indent: "Indent every paragraph",
  replace: "Replace the search term in every paragraph",
  fontSize: `Set the font size of all the text to ${fontSize} (styled document: 6 runs a paragraph)`,
};

const now = () => performance.now();

const median = (values: readonly number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
};

// Until the DOM is updated and laid out: Wordgard's flush measures layout,
// ProseMirror leaves it to the browser, so it's forced for every editor.
const time = (parent: HTMLElement, f: () => void) => {
  const start = now();
  f();
  parent.getBoundingClientRect();
  return now() - start;
};

// What `count` calls of `f` allocate, in KB each.
const allocatedEach = async (parent: HTMLElement, count: number, f: () => void) => {
  await commands.allocationsStart();
  for (let i = 0; i < count; i++) time(parent, f);
  return ((await commands.allocationsStop()) * 1000) / count;
};

// Small values get a decimal; about nothing (or a small negative heap delta) is 0.
const fixed = (value: number, digits = Math.abs(value) < 100 ? 1 : 0) =>
  Math.abs(value) < 0.05 ? "0" : value.toFixed(digits);

// In its own function: a suspended async function keeps its locals, so the
// loop would hold the last editor while the next is measured.
const interact = async (mount: Mount, n: number, plugins: boolean) => {
  const parent = mountPoint();
  const before = heap();
  const editor = await mount(documentHTML(n), parent, plugins);
  const load = timings.load;
  const first = time(parent, () => editor.type(0));
  const interactive = now() - timings.start;
  const memory = heap() - before;
  let typedCount = 1;
  const typed: number[] = [];
  for (; typedCount < 1 + warmup + keystrokes; typedCount++) {
    const i = typedCount;
    const ms = time(parent, () => editor.type(i));
    if (i > warmup) typed.push(ms);
  }
  const keystrokeKB = await allocatedEach(parent, keystrokes, () => editor.type(typedCount++));
  expect(parent.querySelectorAll("p")[Math.floor(n / 2)]?.textContent).toContain(
    "x".repeat(typedCount)
  );
  const entered: number[] = [];
  for (let i = 0; i < warmup + enters; i++) {
    const ms = time(parent, () => editor.enter());
    if (i >= warmup) entered.push(ms);
  }
  const enterKB = await allocatedEach(parent, enters, () => editor.enter());
  expect(parent.querySelectorAll("p").length).toBe(n + warmup + 2 * enters);
  const formatted: number[] = [];
  if (memory < formatLimit)
    for (let i = 0; i < formats; i++) formatted.push(time(parent, () => editor.format(i % 2 == 0)));
  editor.destroy();
  parent.remove();
  await settle();
  return { load, first, interactive, memory, typed, keystrokeKB, entered, enterKB, formatted };
};

type InteractRun = Awaited<ReturnType<typeof interact>>;

const bulk = async (
  name: string,
  mount: Mount,
  n: number,
  kind: Bulk,
  variant: Variant,
  sample: boolean,
  plugins: boolean
) => {
  const parent = mountPoint();
  const html = kind == "fontSize" ? styledHTML(n) : documentHTML(n);
  const editor = await mount(html, parent, plugins);
  const base = heap();
  if (sample) await commands.allocationsStart();
  const start = now();
  const result = editor.bulk(kind, variant, 1);
  parent.getBoundingClientRect();
  const ms = now() - start;
  const after = heapNow() - base;
  const allocated = sample ? await commands.allocationsStop() : 0;
  const held = heap() - base;
  // Elements the editor drew differently from its document: reported, not
  // failed, as a bug in the editor isn't one in the benchmark.
  let stale = 0;
  if (result) {
    if (kind == "indent") stale = n - parent.querySelectorAll('p[style*="margin-left"]').length;
    else if (kind == "replace")
      stale =
        n -
        [...parent.querySelectorAll("p")].filter((p) => p.textContent?.includes(replacement))
          .length;
    else {
      const sized = [...parent.querySelectorAll<HTMLElement>('[style*="font-size"]')];
      expect(sized.length, `${name} drew no font size`).toBeGreaterThan(0);
      stale = sized.filter((element) => element.style.fontSize != fontSize).length;
    }
  }
  // Replacements drawn inside a mark's element: the same in every editor.
  const marked = [...parent.querySelectorAll("strong, em, a, span")].filter((element) =>
    element.textContent?.includes(replacement)
  ).length;
  const events = editor.undoDepth();
  const undo = result ? time(parent, () => editor.undo()) : 0;
  const restored = editor.pristine();
  editor.destroy();
  parent.remove();
  await settle();
  return result && { ...result, ms, after, allocated, held, events, undo, restored, marked, stale };
};

type BulkRun = NonNullable<Awaited<ReturnType<typeof bulk>>>;

const log = (text: string) => {
  // As it goes, so a crash keeps what came before.
  // eslint-disable-next-line no-console
  console.log(text);
};

const interactionRows = async (plugins: boolean) => {
  const rows: string[] = [];
  for (const n of sizes) {
    const results = new Map<string, InteractRun[]>();
    // Editors interleaved within each run, so drift reaches them all alike.
    for (let r = 0; r < runs; r++)
      for (const [name, mount] of editors)
        results.set(name, [...(results.get(name) ?? []), await interact(mount, n, plugins)]);
    for (const [name, list] of results) {
      const m = (f: (run: InteractRun) => number) => median(list.map(f));
      const format = list.every((run) => run.formatted.length)
        ? fixed(m((run) => median(run.formatted)))
        : `skipped (> ${formatLimit} MB held)`;
      const row = [
        n,
        name,
        fixed(m((run) => run.load)),
        fixed(
          m((run) => run.first),
          1
        ),
        fixed(m((run) => run.interactive)),
        fixed(
          m((run) => median(run.typed)),
          1
        ),
        fixed(m((run) => run.keystrokeKB)),
        fixed(
          m((run) => median(run.entered)),
          1
        ),
        fixed(m((run) => run.enterKB)),
        format,
        fixed(m((run) => run.memory)),
      ];
      rows.push(`| ${row.join(" | ")} |`);
      log(rows.at(-1) ?? "");
    }
  }
  return rows;
};

const bulkRows = async (variants: Variant[], plugins: boolean) => {
  const cases = casesOf(variants);
  const rows = new Map<Bulk, string[]>(kinds.map((kind) => [kind, []]));
  // A first bulk edit of each kind compiles its code: done here, so it isn't counted.
  for (const [kind, variant] of cases)
    for (const [name, mount] of editors) await bulk(name, mount, 20, kind, variant, false, plugins);
  // The last size's time and heap per editor and case, to project the next one's.
  const previous = new Map<string, { n: number; ms: number; after: number }>();
  // Replacements drawn inside a mark's element, by size: the same in every editor.
  const marked = new Map<number, number>();
  for (const n of sizes)
    for (const [kind, variant] of cases) {
      const out = rows.get(kind) ?? [];
      const active = editors.filter(([name]) => {
        const last = previous.get(`${name}/${kind}/${variant}`);
        const scale = last ? (n / last.n) ** 2 : 0;
        const ms = (last?.ms ?? 0) * scale;
        const mb = (last?.after ?? 0) * scale;
        if (ms <= timeLimit && mb <= memoryLimit) return true;
        const why = ms > timeLimit ? `${fixed(ms / 1000)} s` : `${fixed(mb)} MB on the heap`;
        out.push(`| ${n} | ${name} | ${variant} | skipped: projected ${why} |||||||||||`);
        log(out.at(-1) ?? "");
        return false;
      });
      const byEditor = new Map<string, BulkRun[]>();
      // Editors interleaved within each run, as above.
      for (let r = 0; r < runs; r++)
        for (const [name, mount] of active) {
          const run = await bulk(name, mount, n, kind, variant, false, plugins);
          if (run) byEditor.set(name, [...(byEditor.get(name) ?? []), run]);
        }
      // Without plugins: the highlights add spans of their own.
      if (kind == "replace" && !plugins && byEditor.size) {
        const counts = new Set([...byEditor.values()].map((list) => list[0]?.marked ?? 0));
        expect(counts.size).toBe(1);
        marked.set(n, [...counts][0] ?? 0);
      }
      for (const [name, mount] of active) {
        const timed = byEditor.get(name) ?? [];
        const first = timed[0];
        if (!first) continue;
        const sampled = await bulk(name, mount, n, kind, variant, true, plugins);
        const m = (f: (run: BulkRun) => number) => median(timed.map(f));
        previous.set(`${name}/${kind}/${variant}`, {
          n,
          ms: m((run) => run.ms),
          after: m((run) => run.after),
        });
        const row = [
          n,
          name,
          variant,
          first.transactions,
          first.steps,
          first.docs,
          fixed(m((run) => run.ms)),
          fixed(
            m((run) => run.search),
            1
          ),
          fixed(sampled?.allocated ?? 0),
          fixed(m((run) => run.after)),
          fixed(m((run) => run.held)),
          first.events,
          fixed(m((run) => run.undo)),
          timed.every((run) => run.restored) ? "yes" : "**no**",
          first.stale ? `**no: ${first.stale} elements**` : "yes",
        ];
        out.push(`| ${row.join(" | ")} |`);
        log(out.at(-1) ?? "");
      }
    }
  return { rows, marked };
};

const interactionTable = (rows: string[]) => [
  "| Paragraphs | Editor | Load (ms) | First keystroke (ms) | To first interaction (ms) | Keystroke (ms) | Allocated per keystroke (KB) | Enter (ms) | Allocated per Enter (KB) | Bold all (ms) | Heap held after load (MB) |",
  "|---|---|---|---|---|---|---|---|---|---|---|",
  ...rows,
];

const bulkTables = ({ rows, marked }: Awaited<ReturnType<typeof bulkRows>>) =>
  kinds.flatMap((kind) => [
    "",
    `### ${titles[kind]}`,
    "",
    ...(kind == "replace"
      ? [
          `Replacements drawn inside a mark's element, the same in every editor: ${[...marked].map(([n, count]) => `${count} of ${n}`).join(", ")}.`,
          "",
        ]
      : []),
    "| Paragraphs | Editor | Variant | Transactions | Steps / changes | Documents built | Time (ms) | of which finding (ms) | Allocated (MB) | Heap after, before GC (MB) | Held after GC (MB) | Undo events | Undo (ms) | Undo restores the document | Drawn as the document |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...(rows.get(kind) ?? []),
  ]);

it("times the editors", async () => {
  const build = reactBuild();
  // A first mount compiles each editor's code: done here, so it isn't counted.
  for (const plugins of [false, true])
    for (const [, mount] of editors) await interact(mount, 20, plugins);

  const plain = await interactionRows(false);
  const plainBulk = await bulkRows(["one", "chunked", "batch"], false);
  const withPlugins = await interactionRows(true);
  const withPluginsBulk = await bulkRows(["one", "batch"], true);

  // The benchmark's output.
  log(
    [
      `React ${React.version}, ${build} build, ${navigator.userAgent}`,
      `Medians of ${runs} runs (allocations from one more run, sampled). Per run: ${keystrokes} keystrokes and ${enters} Enters after ${warmup} unmeasured, then ${keystrokes} and ${enters} more sampled for their allocations, ${formats} bold-all changes (on, off). Chunks: about ${chunkSize} steps or changes.`,
      "",
      "## Without plugins",
      "",
      "### Interaction",
      "",
      ...interactionTable(plain),
      ...bulkTables(plainBulk),
      "",
      "## With the stand-in plugins",
      "",
      "### Interaction",
      "",
      ...interactionTable(withPlugins),
      ...bulkTables(withPluginsBulk),
    ].join("\n")
  );
});
