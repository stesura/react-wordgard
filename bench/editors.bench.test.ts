// Times the editors of editors.ts: load, the first keystroke, typing, Enter, bolding the document,
// and bulk edits over every paragraph as one transaction; without plugins, then with plugins.ts'.
// `npm run bench` (React's production build), `npm run bench:dev`, `npm run bench:smoke`.
import React from "react";
import { commands } from "vitest/browser";

import {
  type Bulk,
  type Mount,
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
const titles: Record<Bulk, string> = {
  indent: "Indent every paragraph",
  replace: "Replace the search term in every paragraph",
  fontSize: `Set the font size of all the text to ${fontSize} (styled document: 6 runs a paragraph)`,
};
const shortTitles: Record<Bulk, string> = {
  indent: "Indent every paragraph",
  replace: "Replace All",
  fontSize: "Font size of all the text",
};

// The summary's rows, by document size and editor, keyed by row label.
type Summary = Map<number, Map<string, Map<string, string>>>;
const summaryRows = [
  "To first interaction (ms)",
  "Keystroke (ms)",
  "Allocated per keystroke (KB)",
  "Enter (ms)",
  "Bold all (ms)",
  ...kinds.map((kind) => `${shortTitles[kind]} (ms / MB allocated)`),
];
const record = (summary: Summary, n: number, name: string, row: string, value: string) => {
  const byEditor = summary.get(n) ?? new Map<string, Map<string, string>>();
  summary.set(n, byEditor);
  const values = byEditor.get(name) ?? new Map<string, string>();
  byEditor.set(name, values);
  values.set(row, value);
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
  sample: boolean,
  plugins: boolean
) => {
  const parent = mountPoint();
  const html = kind == "fontSize" ? styledHTML(n) : documentHTML(n);
  const editor = await mount(html, parent, plugins);
  const base = heap();
  if (sample) await commands.allocationsStart();
  const start = now();
  const result = editor.bulk(kind, 1);
  parent.getBoundingClientRect();
  const ms = now() - start;
  const after = heapNow() - base;
  const allocated = sample ? await commands.allocationsStop() : 0;
  // Elements the editor drew differently from its document: noted, not
  // failed, as a bug in the editor isn't one in the benchmark.
  const staleCount = () => {
    if (kind == "indent") return n - parent.querySelectorAll('p[style*="margin-left"]').length;
    if (kind == "replace")
      return (
        n -
        [...parent.querySelectorAll("p")].filter((p) => p.textContent?.includes(replacement)).length
      );
    const sized = [...parent.querySelectorAll<HTMLElement>('[style*="font-size"]')];
    expect(sized.length, `${name} drew no font size`).toBeGreaterThan(0);
    return sized.filter((element) => element.style.fontSize != fontSize).length;
  };
  const stale = staleCount();
  // Replacements drawn inside a mark's element: the same in every editor.
  const marked = [...parent.querySelectorAll("strong, em, a, span")].filter((element) =>
    element.textContent?.includes(replacement)
  ).length;
  const undo = time(parent, () => editor.undo());
  expect(editor.pristine(), `${name}'s undo restores the document`).toBe(true);
  editor.destroy();
  parent.remove();
  await settle();
  return { ...result, ms, after, allocated, undo, marked, stale };
};

type BulkRun = Awaited<ReturnType<typeof bulk>>;

const log = (text: string) => {
  // As it goes, so a crash keeps what came before.
  // eslint-disable-next-line no-console
  console.log(text);
};

const interactionRows = async (plugins: boolean, summary: Summary) => {
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
      const interactive = fixed(m((run) => run.interactive));
      const keystroke = fixed(
        m((run) => median(run.typed)),
        1
      );
      const keystrokeKB = fixed(m((run) => run.keystrokeKB));
      const enter = fixed(
        m((run) => median(run.entered)),
        1
      );
      const row = [
        n,
        name,
        fixed(m((run) => run.load)),
        fixed(
          m((run) => run.first),
          1
        ),
        interactive,
        keystroke,
        keystrokeKB,
        enter,
        fixed(m((run) => run.enterKB)),
        format,
      ];
      rows.push(`| ${row.join(" | ")} |`);
      log(rows.at(-1) ?? "");
      record(summary, n, name, "To first interaction (ms)", interactive);
      record(summary, n, name, "Keystroke (ms)", keystroke);
      record(summary, n, name, "Allocated per keystroke (KB)", keystrokeKB);
      record(summary, n, name, "Enter (ms)", enter);
      record(summary, n, name, "Bold all (ms)", format);
    }
  }
  return rows;
};

const bulkRows = async (plugins: boolean, summary: Summary) => {
  const rows = new Map<Bulk, string[]>(kinds.map((kind) => [kind, []]));
  // Editors that drew an edit differently from its document, by edit.
  const stale = new Map<Bulk, string[]>(kinds.map((kind) => [kind, []]));
  // A first bulk edit of each kind compiles its code: done here, so it isn't counted.
  for (const kind of kinds)
    for (const [name, mount] of editors) await bulk(name, mount, 20, kind, false, plugins);
  // The last size's time and heap per editor and edit, to project the next one's.
  const previous = new Map<string, { n: number; ms: number; after: number }>();
  // Replacements drawn inside a mark's element, by size: the same in every editor.
  const marked = new Map<number, number>();
  for (const n of sizes)
    for (const kind of kinds) {
      const out = rows.get(kind) ?? [];
      const summaryRow = `${shortTitles[kind]} (ms / MB allocated)`;
      const active = editors.filter(([name]) => {
        const last = previous.get(`${name}/${kind}`);
        const scale = last ? (n / last.n) ** 2 : 0;
        const ms = (last?.ms ?? 0) * scale;
        const mb = (last?.after ?? 0) * scale;
        if (ms <= timeLimit && mb <= memoryLimit) return true;
        const why = ms > timeLimit ? `${fixed(ms / 1000)} s` : `${fixed(mb)} MB on the heap`;
        out.push(`| ${n} | ${name} | skipped: projected ${why} |||||||`);
        log(out.at(-1) ?? "");
        record(summary, n, name, summaryRow, "skipped");
        return false;
      });
      const byEditor = new Map<string, BulkRun[]>();
      // Editors interleaved within each run, as above.
      for (let r = 0; r < runs; r++)
        for (const [name, mount] of active)
          byEditor.set(name, [
            ...(byEditor.get(name) ?? []),
            await bulk(name, mount, n, kind, false, plugins),
          ]);
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
        const sampled = await bulk(name, mount, n, kind, true, plugins);
        const m = (f: (run: BulkRun) => number) => median(timed.map(f));
        previous.set(`${name}/${kind}`, {
          n,
          ms: m((run) => run.ms),
          after: m((run) => run.after),
        });
        const time = fixed(m((run) => run.ms));
        const allocated = fixed(sampled.allocated);
        const row = [
          n,
          name,
          first.steps,
          first.docs,
          time,
          fixed(
            m((run) => run.search),
            1
          ),
          allocated,
          fixed(m((run) => run.after)),
          fixed(m((run) => run.undo)),
        ];
        out.push(`| ${row.join(" | ")} |`);
        log(out.at(-1) ?? "");
        record(summary, n, name, summaryRow, `${time} / ${allocated}`);
        if (first.stale)
          stale.get(kind)?.push(`${name} at ${n} paragraphs (${first.stale} elements)`);
      }
    }
  return { rows, marked, stale };
};

const interactionTable = (rows: string[]) => [
  "| Paragraphs | Editor | Load (ms) | First keystroke (ms) | To first interaction (ms) | Keystroke (ms) | Allocated per keystroke (KB) | Enter (ms) | Allocated per Enter (KB) | Bold all (ms) |",
  "|---|---|---|---|---|---|---|---|---|---|",
  ...rows,
];

const bulkTables = ({ rows, marked, stale }: Awaited<ReturnType<typeof bulkRows>>) =>
  kinds.flatMap((kind) => {
    const wrong = stale.get(kind) ?? [];
    return [
      "",
      `### ${titles[kind]}`,
      "",
      ...(kind == "replace" && marked.size
        ? [
            `Replacements drawn inside a mark's element, the same in every editor: ${[...marked].map(([n, count]) => `${count} of ${n}`).join(", ")}.`,
            "",
          ]
        : []),
      "| Paragraphs | Editor | Steps / changes | Documents built | Time (ms) | of which finding (ms) | Allocated (MB) | Heap after, before GC (MB) | Undo (ms) |",
      "|---|---|---|---|---|---|---|---|---|",
      ...(rows.get(kind) ?? []),
      ...(wrong.length ? ["", `Drawn differently from the document: ${wrong.join("; ")}.`] : []),
    ];
  });

const summaryTables = (summary: Summary) =>
  [...summary].flatMap(([n, byEditor]) => [
    "",
    `### ${n.toLocaleString("en-US")} paragraphs`,
    "",
    `| | ${[...byEditor.keys()].join(" | ")} |`,
    `|---|${[...byEditor.keys()].map(() => "---|").join("")}`,
    ...summaryRows.map(
      (row) =>
        `| ${row} | ${[...byEditor.values()].map((values) => values.get(row) ?? "").join(" | ")} |`
    ),
  ]);

it("times the editors", async () => {
  const build = reactBuild();
  // A first mount compiles each editor's code: done here, so it isn't counted.
  for (const plugins of [false, true])
    for (const [, mount] of editors) await interact(mount, 20, plugins);

  const plainSummary: Summary = new Map();
  const plain = await interactionRows(false, plainSummary);
  const plainBulk = await bulkRows(false, plainSummary);
  const pluginsSummary: Summary = new Map();
  const withPlugins = await interactionRows(true, pluginsSummary);
  const withPluginsBulk = await bulkRows(true, pluginsSummary);

  // The benchmark's output.
  log(
    [
      `React ${React.version}, ${build} build, ${navigator.userAgent}`,
      `Medians of ${runs} runs (allocations from one more run, sampled). Per run: ${keystrokes} keystrokes and ${enters} Enters after ${warmup} unmeasured, then ${keystrokes} and ${enters} more sampled for their allocations, ${formats} bold-all changes (on, off). Bulk edits: one transaction each, timed until drawn; allocations in MB.`,
      "",
      "## Without plugins",
      ...summaryTables(plainSummary),
      "",
      "### Interaction",
      "",
      ...interactionTable(plain),
      ...bulkTables(plainBulk),
      "",
      "## With the stand-in plugins",
      ...summaryTables(pluginsSummary),
      "",
      "### Interaction",
      "",
      ...interactionTable(withPlugins),
      ...bulkTables(withPluginsBulk),
    ].join("\n")
  );
});
