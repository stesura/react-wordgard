// Times load, a keystroke and formatting the whole document (Ctrl+A, bold), and
// measures the memory the loaded editor holds, in
// ReactWordgard, plain Wordgard, react-prosemirror and plain ProseMirror, on
// the same documents. react-prosemirror is our fork's copy in src/prosemirror,
// imported here only to compare against; once that folder is deleted, this
// compares against the published package instead.
// `npm run bench` (React's production build), `npm run bench:dev`,
// `npm run bench:smoke` (small documents, to check it runs; `--mode
// smoke-development` for the development build).
import { type Node as PMNode, DOMParser as PMParser } from "prosemirror-model";
import { schema as pmSchema } from "prosemirror-schema-basic";
import { EditorState, type Plugin } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import React, { createElement } from "react";
import { type Root, createRoot } from "react-dom/client";
import { Leaf } from "wordgard/doc";
import { Wordgard } from "wordgard/editor";
import { basicSchema, image } from "wordgard/schema";
import { GardState } from "wordgard/state";
import { Strong } from "wordgard/types";

import { ReactWordgard } from "../src/ReactWordgard.js";
import {
  ProseMirror,
  ProseMirrorDoc,
  reactKeys,
  useEditorEffect,
} from "../src/prosemirror/index.js";

const smoke = import.meta.env.MODE.startsWith("smoke");
const development = import.meta.env.MODE.endsWith("development");
const sizes = smoke ? [50] : [2500, 15000];
const keystrokes = smoke ? 5 : 30;
const warmup = smoke ? 1 : 5;
const formats = smoke ? 2 : 4;
// Chromium gives a page at most 4 GB of heap. react-prosemirror holds about
// 2 GB at 15,000 paragraphs with inline nodes, and formatting all of them
// then crashes the page: an editor holding more than this skips the format.
const formatLimit = 1000;

const img = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
const paragraphs = {
  marks:
    "<p>Lorem ipsum <strong>dolor</strong> sit amet, <em>consectetur</em> adipiscing elit.</p>",
  "marks and inline nodes": `<p>Lorem <em>ipsum</em> <strong>dolor</strong> <img src="${img}"> sit<br>amet, <a href="https://x.example">consectetur</a> adipiscing elit.</p>`,
};

// An editor under test, drawn: each call returns once the DOM is updated.
type Editor = {
  type: (i: number) => void;
  format: (on: boolean) => void;
  destroy: () => void;
};

type Mount = (html: string, n: number, parent: HTMLElement) => Promise<Editor>;

// Where to type: a few characters into the middle paragraph.
const middle = (lengths: readonly number[]) =>
  lengths.slice(0, Math.floor(lengths.length / 2)).reduce((sum, len) => sum + len, 0) + 4;

const wordgard =
  (create: (spec: Wordgard.Spec) => Wordgard): Mount =>
  async (html, n, parent) => {
    // basicSchema has no images: image() adds them, as prosemirror-schema-basic has.
    const state = GardState.create({ doc: html.repeat(n), config: [basicSchema(), image()] });
    const start = performance.now();
    const wg = create({ state, parent });
    wg.flush();
    parent.getBoundingClientRect();
    timings.load = performance.now() - start;
    const at = middle(wg.state.doc.content.map((node) => node.length));
    const update = (spec: Parameters<Wordgard["dispatch"]>[0]) => {
      wg.dispatch(spec);
      wg.flush();
    };
    return {
      type: (i) => update({ changes: { from: at + i, insert: [Leaf.text("x")] } }),
      format: (on) =>
        update({
          changes: {
            from: 0,
            to: wg.state.doc.length,
            ...(on ? { add: Strong } : { remove: Strong }),
          },
        }),
      destroy: () => wg.dom.remove(),
    };
  };

const pmDoc = (html: string, n: number) => {
  const dom = document.createElement("div");
  dom.innerHTML = html.repeat(n);
  return PMParser.fromSchema(pmSchema).parse(dom);
};

const pmMiddle = (doc: PMNode) => {
  const lengths: number[] = [];
  doc.forEach((node) => lengths.push(node.nodeSize));
  return middle(lengths);
};

const pmEditor = (view: EditorView, at: number, destroy: () => void): Editor => ({
  type: (i) => view.dispatch(view.state.tr.insertText("x", at + i)),
  format: (on) => {
    const { tr, doc } = view.state;
    const mark = pmSchema.marks.strong;
    view.dispatch(
      on ? tr.addMark(0, doc.content.size, mark.create()) : tr.removeMark(0, doc.content.size, mark)
    );
  },
  destroy,
});

const proseMirror: Mount = async (html, n, parent) => {
  const doc = pmDoc(html, n);
  const state = EditorState.create({ doc });
  const start = performance.now();
  const view = new EditorView(parent, { state });
  parent.getBoundingClientRect();
  timings.load = performance.now() - start;
  return pmEditor(view, pmMiddle(doc), () => view.destroy());
};

// Mounted as the demo does, with the fork's stable contexts. Its dispatch
// commits with flushSync, so the DOM is updated when it returns.
const reactProseMirror: Mount = (html, n, parent) => {
  const doc = pmDoc(html, n);
  const plugins: Plugin[] = [reactKeys()];
  const state = EditorState.create({ doc, plugins });
  return new Promise((resolve) => {
    let root: Root | null = null;
    const start = performance.now();
    const Ready = () => {
      useEditorEffect((view) => {
        parent.getBoundingClientRect();
        timings.load = performance.now() - start;
        resolve(pmEditor(view, pmMiddle(doc), () => root?.unmount()));
      }, []);
      return null;
    };
    root = createRoot(parent);
    root.render(
      createElement(
        ProseMirror,
        { defaultState: state, stableContexts: true },
        createElement(ProseMirrorDoc),
        createElement(Ready)
      )
    );
  });
};

const editors: [string, Mount][] = [
  ["ReactWordgard", wordgard(ReactWordgard.create)],
  ["Wordgard", wordgard(Wordgard.create)],
  ["react-prosemirror", reactProseMirror],
  ["ProseMirror", proseMirror],
];

const timings = { load: 0 };

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

// The JS heap after a full garbage collection, in MB (Chromium flags in
// vitest.config.ts).
const heap = () => {
  const gc = Reflect.get(window, "gc");
  if (typeof gc == "function") gc();
  return (Reflect.get(performance, "memory")?.usedJSHeapSize ?? 0) / 1e6;
};

// React's development build has debug internals its production build lacks.
const reactBuild = () => {
  const internals = Reflect.get(React, "__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED");
  return internals && "ReactDebugCurrentFrame" in internals ? "development" : "production";
};

const style = document.createElement("style");
style.textContent = "img { width: 20px; height: 20px; }";
document.head.appendChild(style);

it("times the editors", async () => {
  const build = reactBuild();
  if (build != (development ? "development" : "production"))
    throw new Error(`Expected another React build than ${build}`);
  const rows: string[] = [];
  for (const [docName, html] of Object.entries(paragraphs))
    for (const n of sizes)
      for (const [name, mount] of editors) {
        const parent = document.createElement("div");
        parent.style.cssText = "position: absolute; left: 0; top: 0; width: 600px;";
        document.body.appendChild(parent);
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
          for (let i = 0; i < formats; i++)
            formatted.push(time(parent, () => editor.format(i % 2 == 0)));
        // The editor drew the document and what was typed.
        const drawn = parent.querySelectorAll("p");
        expect(drawn.length).toBe(n);
        expect(parent.querySelectorAll("img[src]").length).toBe(html.includes("<img") ? n : 0);
        expect(drawn[Math.floor(n / 2)]?.textContent).toContain("x".repeat(warmup + keystrokes));
        editor.destroy();
        parent.remove();
        // Lets React finish unmounting, so the next "before" reading is clean.
        await new Promise((resolve) => setTimeout(resolve, 100));
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
