// Where the time to load, to type a keystroke and to format the whole document
// goes: Chromium's CPU profiler around each, in the editors of editors.ts
// (cpuProfile.ts), by function and by script file.
// `npm run bench:profile` (React's production build), `npm run
// bench:profile-dev`; `--mode profile-smoke` for small documents.
import React from "react";
import { commands } from "vitest/browser";

import {
  type Mount,
  documentHTML,
  editors,
  heap,
  mountPoint,
  reactBuild,
  settle,
  sizes,
  smoke,
} from "./editors.js";
import type { CpuProfile } from "./cpuProfile.js";

declare module "vitest/browser" {
  interface BrowserCommands {
    profileStart: () => Promise<void>;
    profileStop: () => Promise<CpuProfile>;
  }
}

const keystrokes = smoke ? 5 : 30;
const warmup = smoke ? 1 : 5;
const formats = smoke ? 2 : 4;
// As in the timing benchmark: formatting all of an editor holding more than
// this many MB would crash the page (react-prosemirror at 15,000 paragraphs).
const formatLimit = 1000;
// The functions listed, by time with their callees.
const top = 25;
// Not work: the profiler waiting, and its root.
const idle = new Set(["(idle)", "(root)"]);
// react-wordgard's own functions: its sources are served as TypeScript, as are
// the benchmark's, left out.
const ours = (name: string) =>
  /\.tsx?:\d+$/.test(name) && !/ (editors|profile\.bench\.test)\.ts:/.test(name);

// In its own function: a suspended async function keeps its locals, so the
// test's loop would hold the last editor while the next is measured.
const measure = async (mount: Mount, n: number) => {
  const parent = mountPoint();
  const before = heap();
  await commands.profileStart();
  const editor = await mount(documentHTML(n), parent, false);
  const load = await commands.profileStop();
  const held = heap() - before;
  for (let i = 0; i < warmup; i++) editor.type(i);
  await commands.profileStart();
  for (let i = warmup; i < warmup + keystrokes; i++) {
    editor.type(i);
    // Layout, which Wordgard's flush measures and ProseMirror leaves to the
    // browser, as the timing benchmark does.
    parent.getBoundingClientRect();
  }
  const typing = await commands.profileStop();
  let formatting: CpuProfile | null = null;
  if (held < formatLimit) {
    await commands.profileStart();
    for (let i = 0; i < formats; i++) {
      editor.format(i % 2 == 0);
      parent.getBoundingClientRect();
    }
    formatting = await commands.profileStop();
  }
  expect(parent.querySelectorAll("p")[Math.floor(n / 2)]?.textContent).toContain(
    "x".repeat(warmup + keystrokes)
  );
  editor.destroy();
  parent.remove();
  await settle();
  return { load, typing, formatting };
};

// A profile's times, in ms per one of `count` runs.
const table = (title: string, profile: CpuProfile, count: number, what: string) => {
  const ms = (time: number) => (time / count).toFixed(2);
  const rows = (heading: string, functions: CpuProfile["functions"]) => [
    `| ${heading} | With callees (ms) | Own (ms) |`,
    "|---|---|---|",
    ...[...functions]
      .sort((a, b) => b.total - a.total)
      .slice(0, top)
      .map((f) => `| ${f.name.replaceAll("|", "\\|")} | ${ms(f.total)} | ${ms(f.self)} |`),
    "",
  ];
  const busy =
    profile.ms - profile.functions.reduce((sum, f) => sum + (idle.has(f.name) ? f.self : 0), 0);
  const own = profile.functions.filter((f) => ours(f.name));
  return [
    `${title}: ${ms(busy)} ms of work ${what}`,
    "",
    ...rows(
      "Function",
      profile.functions.filter((f) => !idle.has(f.name))
    ),
    ...(own.length ? rows("react-wordgard's functions", own) : []),
    "| Script | Own (ms) |",
    "|---|---|",
    ...profile.files
      .filter((f) => f.self / count >= 0.01)
      .sort((a, b) => b.self - a.self)
      .map((f) => `| ${f.name} | ${ms(f.self)} |`),
  ].join("\n");
};

it("profiles load, a keystroke and formatting the whole document", async () => {
  const build = reactBuild();
  // A first mount compiles each editor's code: done here, so it isn't counted.
  for (const [, mount] of editors) await measure(mount, 20);
  const tables: string[] = [];
  for (const n of sizes)
    for (const [name, mount] of editors) {
      const title = `${n} paragraphs, ${name}`;
      const { load, typing, formatting } = await measure(mount, n);
      const output = [
        table(title, load, 1, "to load"),
        table(title, typing, keystrokes, "per keystroke"),
        formatting
          ? table(title, formatting, formats, "per whole-document format change")
          : `${title}: formatting skipped (> ${formatLimit} MB held)`,
      ].join("\n\n");
      tables.push(output);
      // As it goes, so a crash keeps the tables before it.
      // eslint-disable-next-line no-console
      console.log(output);
    }
  // The benchmark's output.
  // eslint-disable-next-line no-console
  console.log(
    [
      `React ${React.version}, ${build} build, ${navigator.userAgent}`,
      `CPU profiles of mounting, then of ${keystrokes} keystrokes after ${warmup} unprofiled, per keystroke, then of ${formats} whole-document format changes (bold on, off), per change. "With callees" counts a recursive function's outermost call only.`,
      "",
      ...tables.flatMap((output) => [output, ""]),
    ].join("\n")
  );
});
