// The editors the benchmarks compare: react-wordgard, vue-wordgard,
// svelte-wordgard, plain Wordgard, react-prosemirror
// (@handlewithcare/react-prosemirror from npm) and plain ProseMirror. All get
// the same document (documents.ts), alike schemas (schemas.ts) and their own
// history.
import {
  ProseMirrorDoc,
  ProseMirror as ReactProseMirror,
  reactKeys,
  useEditorEffect,
} from "@handlewithcare/react-prosemirror";
import { splitBlock } from "prosemirror-commands";
import { history as pmHistory, undo as pmUndo } from "prosemirror-history";
import {
  Fragment,
  Mark as PMMark,
  type Node as PMNode,
  DOMParser as PMParser,
  Slice,
} from "prosemirror-model";
import { EditorState, TextSelection, type Transaction } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import React, { createElement } from "react";
import { type Root, createRoot } from "react-dom/client";
import { mount, unmount } from "svelte";
import { type App, createApp, defineComponent, h } from "vue";
import { Command, enter } from "wordgard/command";
import { Leaf, Plot } from "wordgard/doc";
import { Wordgard } from "wordgard/editor";
import { undo as wgUndo } from "wordgard/history";
import { GardState } from "wordgard/state";
import { Strong } from "wordgard/types";

import {
  WordgardDoc,
  WordgardEditor,
  useEditorEffect as useWordgardEffect,
} from "@stesura/react-wordgard";
import {
  WordgardDoc as VueWordgardDoc,
  WordgardEditor as VueWordgardEditor,
  useEditorEffect as useVueWordgardEffect,
} from "@stesura/vue-wordgard";
import { replacement, searchTerm } from "./documents.js";
import SvelteEditor from "./svelte/Editor.svelte";
import { pmPlugins, wgPlugins } from "./plugins.js";
import { FontSize, Indent, pmSchema, wgSchema } from "./schemas.js";

export { documentHTML, styledHTML } from "./documents.js";

export const smoke = import.meta.env.MODE.includes("smoke");
export const development = import.meta.env.MODE.endsWith("development");
// `VITE_BENCH_SIZES=5000` runs the sizes given instead.
const sizesGiven = String(import.meta.env.VITE_BENCH_SIZES ?? "")
  .split(",")
  .filter(Boolean)
  .map(Number);
export const sizes = sizesGiven.length ? sizesGiven : smoke ? [50] : [50, 500, 1500];

// A bulk edit over every paragraph, in one transaction: an indent, replacing
// the search term as Replace All does, or setting the font size of all the
// text (on styledHTML's document).
export type Bulk = "indent" | "replace" | "fontSize";
export const fontSize = "14px";

export type BulkResult = {
  // ms finding what to change (the paragraphs, the search term or the runs).
  search: number;
  // Steps (ProseMirror) or change set entries (Wordgard).
  steps: number;
  // Documents built: one per step in ProseMirror, one per transaction in Wordgard.
  docs: number;
};

// An editor under test, drawn: each call returns once the DOM is updated.
export type Editor = {
  type: (i: number) => void;
  enter: () => void;
  format: (on: boolean) => void;
  bulk: (kind: Bulk, level: number) => BulkResult;
  undo: () => void;
  // Whether the document is the one loaded, the stand-in plugins' edited
  // flags aside: undo is an edit too, which flags what it touches.
  pristine: () => boolean;
  destroy: () => void;
};

// `plugins`: with the stand-in plugins of plugins.ts.
export type Mount = (html: string, parent: HTMLElement, plugins: boolean) => Promise<Editor>;

// The last mount's start and load time, in ms.
export const timings = { start: 0, load: 0 };

const now = () => performance.now();

// A document's JSON without the edited flags (ProseMirror's attribute,
// Wordgard's mark).
const unflagged = (json: unknown) =>
  JSON.stringify(json, (key, value: unknown) => {
    // Wordgard writes a null parameter once a node has had marks.
    if (key == "edited" || key == "Edited" || (key == "param" && value === null)) return undefined;
    if (key == "marks" && value && typeof value == "object" && !Array.isArray(value)) {
      const names = Object.keys(value).filter((name) => name != "Edited");
      return names.length ? value : undefined;
    }
    return value;
  });

// Where to type: a few characters into the middle paragraph.
const middle = (lengths: readonly number[]) =>
  lengths.slice(0, Math.floor(lengths.length / 2)).reduce((sum, len) => sum + len, 0) + 4;

// The parsed document and its state, the cursor in the middle paragraph, as
// ProseMirror's.
const wgState = (html: string, plugins: boolean) => {
  const parsed = GardState.create({
    doc: html,
    config: [...wgSchema, ...(plugins ? wgPlugins : [])],
  });
  const loaded = parsed.doc;
  const at = middle(loaded.content.map((node) => node.length));
  return { state: parsed.update({ selection: { anchor: at } }).state, loaded, at };
};

const wgEditor = (wg: Wordgard, loaded: Plot, at: number, destroy: () => void): Editor => {
  const update = (spec: Parameters<Wordgard["dispatch"]>[0]) => {
    wg.dispatch(spec);
    wg.flush();
  };
  // Paragraph positions, or the search term's, in document order, as
  // Wordgard's commands give changes: out of order, each change becomes a
  // change set of its own, composed into the others (quadratic: 1 s at 5,000
  // paragraphs).
  const find = (kind: Bulk) => {
    const out: number[] = [];
    let pos = 0;
    for (const node of wg.state.doc.content) {
      if (kind == "indent") out.push(pos);
      else if (node instanceof Plot) {
        const index = node.textContent().indexOf(searchTerm);
        if (index >= 0) out.push(pos + 1 + index);
      }
      pos += node.length;
    }
    return out;
  };
  return {
    type: (i) => update({ changes: { from: at + i, insert: [Leaf.text("x")] } }),
    enter: () => {
      Command.dispatch(wg, enter);
      wg.flush();
    },
    format: (on) =>
      update({
        changes: {
          from: 0,
          to: wg.state.doc.length,
          ...(on ? { add: Strong } : { remove: Strong }),
        },
      }),
    bulk: (kind, level) => {
      if (kind == "fontSize") {
        // One change over the whole document: a mark holds one value, so
        // setting it is one section however the runs were styled.
        update({ changes: { from: 0, to: wg.state.doc.length, add: FontSize.of(fontSize) } });
        return { search: 0, steps: 1, docs: 1 };
      }
      const start = now();
      const positions = find(kind);
      const search = now() - start;
      const { doc } = wg.state;
      // Each position in the document before the transaction: one pass.
      const change = (pos: number) => {
        if (kind == "indent") return { from: pos, add: Indent.of(level) };
        const to = pos + searchTerm.length;
        // ProseMirror's marksAcross: the match's own marks, less the
        // non-inclusive ones (a link) that don't go on after it. Wordgard's
        // `marks(across)` gives what typing over the range would get instead,
        // the marks before it.
        const after = doc.resolve(to).nodeAfter?.tag.marks ?? [];
        const marks = doc
          .resolve(pos + 1)
          .marks()
          .filter((mark) => mark.type.inclusive || mark.isInSet(after));
        return { from: pos, to, insert: [Leaf.text(replacement, marks)] };
      };
      update({ changes: positions.map(change) });
      return { search, steps: positions.length, docs: 1 };
    },
    undo: () => {
      Command.dispatch(wg, wgUndo);
      wg.flush();
    },
    pristine: () => unflagged(wg.state.doc.toJSON()) == unflagged(loaded.toJSON()),
    destroy,
  };
};

const wordgard: Mount = async (html, parent, plugins) => {
  const { state, loaded, at } = wgState(html, plugins);
  timings.start = now();
  const wg = Wordgard.create({ state, parent });
  wg.flush();
  parent.getBoundingClientRect();
  timings.load = now() - timings.start;
  return wgEditor(wg, loaded, at, () => wg.dom.remove());
};

// Mounted as an app does, as react-prosemirror is below.
const reactWordgard: Mount = (html, parent, plugins) => {
  const { state, loaded, at } = wgState(html, plugins);
  return new Promise((resolve) => {
    let root: Root | null = null;
    timings.start = now();
    const Ready = () => {
      useWordgardEffect((wg) => {
        wg.flush();
        parent.getBoundingClientRect();
        timings.load = now() - timings.start;
        resolve(wgEditor(wg, loaded, at, () => root?.unmount()));
      }, []);
      return null;
    };
    root = createRoot(parent);
    root.render(
      createElement(WordgardEditor, { state }, createElement(WordgardDoc), createElement(Ready))
    );
  });
};

// Mounted as an app does, as react-wordgard is above.
const vueWordgard: Mount = (html, parent, plugins) => {
  const { state, loaded, at } = wgState(html, plugins);
  return new Promise((resolve) => {
    let app: App | null = null;
    timings.start = now();
    const Ready = defineComponent(() => {
      useVueWordgardEffect((wg) => {
        wg.flush();
        parent.getBoundingClientRect();
        timings.load = now() - timings.start;
        resolve(wgEditor(wg, loaded, at, () => app?.unmount()));
      });
      return () => null;
    });
    app = createApp(() => h(VueWordgardEditor, { state }, () => [h(VueWordgardDoc), h(Ready)]));
    app.mount(parent);
  });
};

// Mounted as an app does, as react-wordgard is above.
const svelteWordgard: Mount = (html, parent, plugins) => {
  const { state, loaded, at } = wgState(html, plugins);
  return new Promise((resolve) => {
    timings.start = now();
    const app = mount(SvelteEditor, {
      target: parent,
      props: {
        editorState: state,
        ready: (wg: Wordgard) => {
          // Svelte's development build records each element's place in its source.
          if ("__svelte_meta" in (parent.firstElementChild ?? {}) != development)
            throw new Error("Expected another Svelte build");
          wg.flush();
          parent.getBoundingClientRect();
          timings.load = now() - timings.start;
          resolve(wgEditor(wg, loaded, at, () => void unmount(app)));
        },
      },
    });
  });
};

const pmDoc = (html: string) => {
  const dom = document.createElement("div");
  dom.innerHTML = html;
  return PMParser.fromSchema(pmSchema).parse(dom);
};

const pmMiddle = (doc: PMNode) => {
  const lengths: number[] = [];
  doc.forEach((node) => lengths.push(node.nodeSize));
  return middle(lengths);
};

const pmState = (doc: PMNode, withPlugins: boolean) => {
  const state = EditorState.create({
    doc,
    plugins: [...(withPlugins ? pmPlugins : []), pmHistory()],
  });
  return state.apply(state.tr.setSelection(TextSelection.create(doc, pmMiddle(doc))));
};

const pmEditor = (view: EditorView, destroy: () => void): Editor => {
  const loaded = view.state.doc;
  const at = pmMiddle(loaded);
  const find = (kind: Bulk) => {
    const out: number[] = [];
    view.state.doc.forEach((node, offset) => {
      if (kind == "indent") out.push(offset);
      else {
        const index = node.textContent.indexOf(searchTerm);
        if (index >= 0) out.push(offset + 1 + index);
      }
    });
    return out.reverse();
  };
  // Dispatches a bulk edit's transaction, counting its steps and documents.
  const dispatch = (tr: Transaction, search: number): BulkResult => {
    const counts = { search, steps: tr.steps.length, docs: tr.docs.length };
    view.dispatch(tr);
    return counts;
  };
  // Each run's textStyle with the new size merged in, as a toolbar does:
  // `addMark` replaces the run's old textStyle, a step a run, and undo
  // restores each run's own size.
  const setFontSize = () => {
    const start = now();
    const textStyle = pmSchema.marks.textStyle;
    if (!textStyle) throw new Error("No textStyle mark");
    const runs: { from: number; to: number; old: PMMark | undefined }[] = [];
    view.state.doc.descendants((node, pos) => {
      if (node.isText)
        runs.push({ from: pos, to: pos + node.nodeSize, old: textStyle.isInSet(node.marks) });
    });
    const search = now() - start;
    const { tr } = view.state;
    for (const { from, to, old } of runs)
      tr.addMark(from, to, textStyle.create({ ...old?.attrs, fontSize }));
    return dispatch(tr, search);
  };
  return {
    type: (i) => view.dispatch(view.state.tr.insertText("x", at + i)),
    enter: () => splitBlock(view.state, view.dispatch),
    format: (on) => {
      const { tr, doc } = view.state;
      const mark = pmSchema.marks.strong;
      if (!mark) throw new Error("No strong mark");
      view.dispatch(
        on
          ? tr.addMark(0, doc.content.size, mark.create())
          : tr.removeMark(0, doc.content.size, mark)
      );
    },
    bulk: (kind, level) => {
      if (kind == "fontSize") return setFontSize();
      const start = now();
      const positions = find(kind);
      const search = now() - start;
      const { tr } = view.state;
      // Last first, so no step moves the positions of the ones after it.
      for (const pos of positions) {
        if (kind == "indent") tr.setNodeAttribute(pos, "indent", level);
        else {
          const to = pos + searchTerm.length;
          const marks = tr.doc.resolve(pos).marksAcross(tr.doc.resolve(to)) ?? PMMark.none;
          tr.replace(pos, to, new Slice(Fragment.from(pmSchema.text(replacement, marks)), 0, 0));
        }
      }
      return dispatch(tr, search);
    },
    undo: () => pmUndo(view.state, view.dispatch),
    pristine: () => unflagged(view.state.doc.toJSON()) == unflagged(loaded.toJSON()),
    destroy,
  };
};

const proseMirror: Mount = async (html, parent, plugins) => {
  const state = pmState(pmDoc(html), plugins);
  timings.start = now();
  const view = new EditorView(parent, { state });
  parent.getBoundingClientRect();
  timings.load = now() - timings.start;
  return pmEditor(view, () => view.destroy());
};

// Mounted as an app does. Its dispatch commits with flushSync, so the DOM is
// updated when it returns.
const reactProseMirror: Mount = (html, parent, plugins) => {
  const base = pmState(pmDoc(html), plugins);
  return new Promise((resolve) => {
    let root: Root | null = null;
    timings.start = now();
    // Timed: reactKeys' tables are react-prosemirror's own work at load, as
    // react-wordgard's keys are.
    const state = base.reconfigure({ plugins: [reactKeys(), ...base.plugins] });
    const Ready = () => {
      useEditorEffect((view) => {
        parent.getBoundingClientRect();
        timings.load = now() - timings.start;
        resolve(pmEditor(view, () => root?.unmount()));
      }, []);
      return null;
    };
    root = createRoot(parent);
    root.render(
      createElement(
        ReactProseMirror,
        { defaultState: state },
        createElement(ProseMirrorDoc),
        createElement(Ready)
      )
    );
  });
};

const all: [string, Mount][] = [
  ["react-wordgard", reactWordgard],
  ["vue-wordgard", vueWordgard],
  ["svelte-wordgard", svelteWordgard],
  ["Wordgard", wordgard],
  ["react-prosemirror", reactProseMirror],
  ["ProseMirror", proseMirror],
];

// `VITE_BENCH_EDITORS=react-wordgard,Wordgard` runs only the editors named.
const only = String(import.meta.env.VITE_BENCH_EDITORS ?? "")
  .split(",")
  .filter(Boolean);
export const editors = all.filter(([name]) => !only.length || only.includes(name));

// The JS heap after a full garbage collection, in MB (Chromium flags in
// vitest.config.ts).
export const heap = () => {
  const gc = Reflect.get(window, "gc");
  if (typeof gc == "function") gc();
  return heapNow();
};

// The JS heap as it is, garbage included, in MB.
export const heapNow = () => (Reflect.get(performance, "memory")?.usedJSHeapSize ?? 0) / 1e6;

// React's development build has debug internals its production build lacks.
export const reactBuild = () => {
  const internals = Reflect.get(React, "__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED");
  const build = internals && "ReactDebugCurrentFrame" in internals ? "development" : "production";
  if (build != (development ? "development" : "production"))
    throw new Error(`Expected another React build than ${build}`);
  return build;
};

// A parent for an editor, at the page's top left.
export const mountPoint = () => {
  const parent = document.createElement("div");
  parent.style.cssText = "position: absolute; left: 0; top: 0; width: 600px;";
  document.body.appendChild(parent);
  return parent;
};

// Lets React finish unmounting, so the next heap reading is clean. React DOM
// keeps the target of the last event it handled until its next event: one on
// the document releases the unmounted editor.
export const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  document.dispatchEvent(new Event("selectionchange"));
};
