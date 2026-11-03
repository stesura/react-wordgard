// The editors the benchmarks compare: ReactWordgard, plain Wordgard,
// react-prosemirror (@handlewithcare/react-prosemirror from npm), Stesura's
// fork of it when a checkout is found (vitest.config.ts), and plain
// ProseMirror. All get the same document (documents.ts), alike schemas
// (schemas.ts) and their own history.
import {
  ProseMirror as UpstreamProseMirror,
  ProseMirrorDoc as UpstreamProseMirrorDoc,
  reactKeys as upstreamReactKeys,
  useEditorEffect as upstreamUseEditorEffect,
} from "@handlewithcare/react-prosemirror";
import {
  ProseMirror as ForkProseMirror,
  ProseMirrorDoc as ForkProseMirrorDoc,
  reactKeys as forkReactKeys,
  useEditorEffect as forkUseEditorEffect,
} from "@stesura/react-prosemirror";
import { splitBlock } from "prosemirror-commands";
import {
  history as pmHistory,
  undo as pmUndo,
  undoDepth as pmUndoDepth,
} from "prosemirror-history";
import {
  Fragment,
  Mark as PMMark,
  type Node as PMNode,
  DOMParser as PMParser,
  Slice,
} from "prosemirror-model";
import { EditorState, type Plugin, TextSelection, type Transaction } from "prosemirror-state";
import { AddMarkStep, AttrStep, RemoveMarkStep, ReplaceStep } from "prosemirror-transform";
import { EditorView } from "prosemirror-view";
import React, { type ComponentType, type ReactNode, createElement } from "react";
import { type Root, createRoot } from "react-dom/client";
import { Command, enter } from "wordgard/command";
import { Leaf, Plot } from "wordgard/doc";
import { Wordgard } from "wordgard/editor";
import { undo as wgUndo, undoDepth as wgUndoDepth } from "wordgard/history";
import { GardState } from "wordgard/state";
import { Strong } from "wordgard/types";

import { ReactWordgard } from "../src/ReactWordgard.js";
import { BatchStep, type InnerStep } from "./batchStep.js";
import { replacement, searchTerm } from "./documents.js";
import { pmPlugins, wgPlugins } from "./plugins.js";
import { FontSize, Indent, continuesEdit, pmSchema, wgSchema } from "./schemas.js";

export { documentHTML, styledHTML } from "./documents.js";

export const smoke = import.meta.env.MODE.includes("smoke");
export const development = import.meta.env.MODE.endsWith("development");
export const sizes = smoke ? [50] : [50, 500, 1500, 5000];

// A bulk edit over every paragraph: an indent, replacing the search term as
// Replace All does, or setting the font size of all the text (on
// styledHTML's document).
export type Bulk = "indent" | "replace" | "fontSize";
// How it's dispatched: one transaction; transactions of about `chunkSize`
// steps or changes each (Stesura's bulk commands); Stesura's batch step
// (ProseMirror only).
export type Variant = "one" | "chunked" | "batch";
export const fontSize = "14px";
export const chunkSize = 500;

export type BulkResult = {
  // ms finding what to change (the search term, or the paragraphs).
  search: number;
  transactions: number;
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
  // Null when the editor has no such variant.
  bulk: (kind: Bulk, variant: Variant, level: number) => BulkResult | null;
  undo: () => void;
  undoDepth: () => number;
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

const chunks = <T>(items: readonly T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};
const chunkOf = (variant: Variant, count: number) =>
  variant == "chunked" ? chunkSize : Math.max(count, 1);

const wordgard =
  (create: (spec: Wordgard.Spec) => Wordgard): Mount =>
  async (html, parent, plugins) => {
    const parsed = GardState.create({
      doc: html,
      config: [...wgSchema, ...(plugins ? wgPlugins : [])],
    });
    const loaded = parsed.doc;
    const at = middle(loaded.content.map((node) => node.length));
    // The cursor in the middle paragraph before load, as ProseMirror's.
    const state = parsed.update({ selection: { anchor: at } }).state;
    timings.start = now();
    const wg = create({ state, parent });
    wg.flush();
    parent.getBoundingClientRect();
    timings.load = now() - timings.start;
    const update = (spec: Parameters<Wordgard["dispatch"]>[0]) => {
      wg.dispatch(spec);
      wg.flush();
    };
    // Paragraph positions, or the search term's, last first: no change then
    // moves the positions of the ones after it.
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
      return out.reverse();
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
      bulk: (kind, variant, level) => {
        if (variant == "batch") return null;
        if (kind == "fontSize") {
          // One change over the whole document: a mark holds one value, so
          // setting it is one section however the runs were styled.
          if (variant == "chunked") return null;
          update({ changes: { from: 0, to: wg.state.doc.length, add: FontSize.of(fontSize) } });
          return { search: 0, transactions: 1, steps: 1, docs: 1 };
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
        const parts = chunks(positions, chunkOf(variant, positions.length));
        // Undrawn in between: Wordgard draws on its next frame, once.
        parts.forEach((part, i) =>
          wg.dispatch({
            // In document order, as Wordgard's commands give them: out of order,
            // each change becomes a change set of its own, composed into the
            // others (quadratic: 1 s at 5,000 paragraphs).
            changes: [...part].reverse().map(change),
            ...(i ? { annotations: continuesEdit.of(true) } : {}),
          })
        );
        wg.flush();
        return { search, transactions: parts.length, steps: positions.length, docs: parts.length };
      },
      undo: () => {
        Command.dispatch(wg, wgUndo);
        wg.flush();
      },
      undoDepth: () => wgUndoDepth(wg.state),
      pristine: () => unflagged(wg.state.doc.toJSON()) == unflagged(loaded.toJSON()),
      destroy: () => wg.dom.remove(),
    };
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

const pmState = (doc: PMNode, plugins: Plugin[], withPlugins: boolean) => {
  const state = EditorState.create({
    doc,
    plugins: [...plugins, ...(withPlugins ? pmPlugins : []), pmHistory()],
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
  let edits = 0;
  // Counts what a bulk edit dispatches. Its transactions are one undo event,
  // as Stesura's bulk commands make: prosemirror-history joins the
  // transactions of one composition.
  const counter = (search: number) => {
    const counts = { search, transactions: 0, steps: 0, docs: 0 };
    const dispatch = (tr: Transaction) => {
      counts.transactions++;
      counts.steps += tr.steps.length;
      counts.docs += tr.docs.length;
      view.dispatch(tr);
    };
    return { counts, dispatch, composition: `bulk-${++edits}` };
  };
  // As Stesura's setMark (its addMarkAcross): each run's textStyle with the
  // new size merged in, the old one removed then the new one added, two steps
  // a run, so that each inverts to what it undid, in a batch step too.
  const setFontSize = (variant: Variant) => {
    const start = now();
    const textStyle = pmSchema.marks.textStyle;
    if (!textStyle) throw new Error("No textStyle mark");
    const runs: { from: number; to: number; old: PMMark | undefined }[] = [];
    view.state.doc.descendants((node, pos) => {
      if (node.isText)
        runs.push({ from: pos, to: pos + node.nodeSize, old: textStyle.isInSet(node.marks) });
    });
    const { counts, dispatch, composition } = counter(now() - start);
    const steps = runs.flatMap(({ from, to, old }): InnerStep[] => [
      ...(old ? [new RemoveMarkStep(from, to, old)] : []),
      new AddMarkStep(from, to, textStyle.create({ ...old?.attrs, fontSize })),
    ]);
    if (variant == "batch") {
      dispatch(view.state.tr.step(new BatchStep(steps)));
      return counts;
    }
    let tr = view.state.tr.setMeta("composition", composition);
    for (const step of steps) {
      tr.step(step);
      if (variant == "chunked" && tr.steps.length >= chunkSize) {
        dispatch(tr);
        tr = view.state.tr.setMeta("composition", composition);
      }
    }
    if (tr.steps.length) dispatch(tr);
    return counts;
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
    bulk: (kind, variant, level) => {
      if (kind == "fontSize") return setFontSize(variant);
      const start = now();
      const positions = find(kind);
      const search = now() - start;
      const { doc } = view.state;
      const step = (pos: number): InnerStep => {
        if (kind == "indent") return new AttrStep(pos, "indent", level);
        const to = pos + searchTerm.length;
        const marks = doc.resolve(pos).marksAcross(doc.resolve(to)) ?? PMMark.none;
        return new ReplaceStep(
          pos,
          to,
          new Slice(Fragment.from(pmSchema.text(replacement, marks)), 0, 0)
        );
      };
      const { counts, dispatch, composition } = counter(search);
      if (variant == "batch") {
        dispatch(view.state.tr.step(new BatchStep(positions.map(step))));
        return counts;
      }
      for (const part of chunks(positions, chunkOf(variant, positions.length))) {
        const tr = view.state.tr.setMeta("composition", composition);
        // Through the transform's methods, as Stesura and prosemirror-search do.
        for (const pos of part) {
          const s = step(pos);
          if (s instanceof AttrStep) tr.setNodeAttribute(s.pos, s.attr, s.value);
          else if (s instanceof ReplaceStep) tr.replace(s.from, s.to, s.slice);
        }
        dispatch(tr);
      }
      return counts;
    },
    undo: () => pmUndo(view.state, view.dispatch),
    undoDepth: () => pmUndoDepth(view.state),
    pristine: () => unflagged(view.state.doc.toJSON()) == unflagged(loaded.toJSON()),
    destroy,
  };
};

const proseMirror: Mount = async (html, parent, plugins) => {
  const state = pmState(pmDoc(html), [], plugins);
  timings.start = now();
  const view = new EditorView(parent, { state });
  parent.getBoundingClientRect();
  timings.load = now() - timings.start;
  return pmEditor(view, () => view.destroy());
};

type ReactProseMirror = {
  ProseMirror: ComponentType<{
    defaultState: EditorState;
    stableContexts?: boolean;
    children?: ReactNode;
  }>;
  ProseMirrorDoc: ComponentType;
  reactKeys: () => Plugin;
  useEditorEffect: (effect: (view: EditorView) => void, deps: unknown[]) => void;
};

// Mounted as an app does. Its dispatch commits with flushSync, so the DOM is
// updated when it returns.
const reactProseMirror =
  (lib: ReactProseMirror, props: { stableContexts?: boolean }): Mount =>
  (html, parent, plugins) => {
    const state = pmState(pmDoc(html), [lib.reactKeys()], plugins);
    return new Promise((resolve) => {
      let root: Root | null = null;
      timings.start = now();
      const Ready = () => {
        lib.useEditorEffect((view) => {
          parent.getBoundingClientRect();
          timings.load = now() - timings.start;
          resolve(pmEditor(view, () => root?.unmount()));
        }, []);
        return null;
      };
      root = createRoot(parent);
      root.render(
        createElement(
          lib.ProseMirror,
          { defaultState: state, ...props },
          createElement(lib.ProseMirrorDoc),
          createElement(Ready)
        )
      );
    });
  };

const upstream: ReactProseMirror = {
  ProseMirror: UpstreamProseMirror,
  ProseMirrorDoc: UpstreamProseMirrorDoc,
  reactKeys: upstreamReactKeys,
  useEditorEffect: upstreamUseEditorEffect,
};
const fork: ReactProseMirror = {
  ProseMirror: ForkProseMirror,
  ProseMirrorDoc: ForkProseMirrorDoc,
  reactKeys: forkReactKeys,
  useEditorEffect: forkUseEditorEffect,
};

export const forkName = "react-prosemirror (Stesura's fork)";
const forkRow: [string, Mount][] =
  import.meta.env.VITE_BENCH_FORK == "true"
    ? [[forkName, reactProseMirror(fork, { stableContexts: true })]]
    : [];

const all: [string, Mount][] = [
  ["ReactWordgard", wordgard(ReactWordgard.create)],
  ["Wordgard", wordgard(Wordgard.create)],
  ["react-prosemirror", reactProseMirror(upstream, {})],
  ...forkRow,
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
