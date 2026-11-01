// The editors and documents the benchmarks compare: ReactWordgard, plain
// Wordgard, react-prosemirror (our fork) and plain ProseMirror, the last two
// from a react-prosemirror checkout (vitest.config.ts).
import {
  ProseMirror,
  ProseMirrorDoc,
  reactKeys,
  useEditorEffect,
} from "@stesura/react-prosemirror";
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

export const smoke = import.meta.env.MODE.includes("smoke");
export const development = import.meta.env.MODE.endsWith("development");
export const sizes = smoke ? [50] : [2500, 15000];

const img = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
export const paragraphs = {
  marks:
    "<p>Lorem ipsum <strong>dolor</strong> sit amet, <em>consectetur</em> adipiscing elit.</p>",
  "marks and inline nodes": `<p>Lorem <em>ipsum</em> <strong>dolor</strong> <img src="${img}"> sit<br>amet, <a href="https://x.example">consectetur</a> adipiscing elit.</p>`,
};

// An editor under test, drawn: each call returns once the DOM is updated.
export type Editor = {
  type: (i: number) => void;
  format: (on: boolean) => void;
  destroy: () => void;
};

export type Mount = (html: string, n: number, parent: HTMLElement) => Promise<Editor>;

// The last mount's load time, in ms.
export const timings = { load: 0 };

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

const all: [string, Mount][] = [
  ["ReactWordgard", wordgard(ReactWordgard.create)],
  ["Wordgard", wordgard(Wordgard.create)],
  ["react-prosemirror", reactProseMirror],
  ["ProseMirror", proseMirror],
];

// `VITE_BENCH_EDITORS=ReactWordgard,Wordgard` runs only the editors named.
const only = String(import.meta.env.VITE_BENCH_EDITORS ?? "")
  .split(",")
  .filter(Boolean);
export const editors = all.filter(([name]) => !only.length || only.includes(name));

// The JS heap after a full garbage collection, in MB (Chromium flags in
// vitest.config.ts).
export const heap = () => {
  const gc = Reflect.get(window, "gc");
  if (typeof gc == "function") gc();
  return (Reflect.get(performance, "memory")?.usedJSHeapSize ?? 0) / 1e6;
};

// React's development build has debug internals its production build lacks.
export const reactBuild = () => {
  const internals = Reflect.get(React, "__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED");
  const build = internals && "ReactDebugCurrentFrame" in internals ? "development" : "production";
  if (build != (development ? "development" : "production"))
    throw new Error(`Expected another React build than ${build}`);
  return build;
};

// A parent for an editor, at the page's top left, and the images' size.
export const mountPoint = () => {
  if (!document.getElementById("bench-style")) {
    const style = document.createElement("style");
    style.id = "bench-style";
    style.textContent = "img { width: 20px; height: 20px; }";
    document.head.appendChild(style);
  }
  const parent = document.createElement("div");
  parent.style.cssText = "position: absolute; left: 0; top: 0; width: 600px;";
  document.body.appendChild(parent);
  return parent;
};

// Lets React finish unmounting, so the next heap reading is clean. React DOM
// keeps the target of the last event it handled (`return_targetInst`; an
// image's load, in an editor) until its next event: one on the document
// releases the unmounted editor.
export const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  document.dispatchEvent(new Event("selectionchange"));
};
