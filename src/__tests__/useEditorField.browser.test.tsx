// useEditorField and useEditorFieldEntry re-render on their own field's change only, and follow a
// WordgardScope to another editor.
import React, { type ReactNode, useLayoutEffect } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Leaf } from "wordgard/doc";
import type { Wordgard } from "wordgard/editor";
import { basicSchema } from "wordgard/schema";
import { GardState, Transaction } from "wordgard/state";

import { WordgardDoc } from "../components/WordgardDoc.js";
import { WordgardEditor } from "../components/WordgardEditor.js";
import { WordgardScope } from "../components/WordgardScope.js";
import { useEditorField, useEditorFieldEntry } from "../hooks/useEditorField.js";
import { useWordgard } from "../hooks/useWordgard.js";

const containers: HTMLElement[] = [];
afterEach(() => {
  for (const container of containers.splice(0)) container.remove();
});

const container = () => {
  const dom = document.createElement("div");
  document.body.appendChild(dom);
  containers.push(dom);
  return dom;
};

const tick = () => new Promise<void>((resolve) => queueMicrotask(resolve));

const bump = Transaction.Effect.define<string>();

// A counter changed by an effect only: typing leaves it as it was.
const counter = GardState.Field.define<number>({
  create: () => 0,
  update: (value, tr) => value + tr.effects.filter((effect) => effect.is(bump)).length,
});

// Entries keyed by the effect's value, each a new object when bumped.
const entries = GardState.Field.define<ReadonlyMap<string, { readonly n: number }>>({
  create: () => new Map(),
  update: (value, tr) => {
    let next: Map<string, { readonly n: number }> | null = null;
    for (const effect of tr.effects) {
      if (!effect.is(bump)) continue;
      next ??= new Map(value);
      next.set(effect.value, { n: (next.get(effect.value)?.n ?? 0) + 1 });
    }
    return next ?? value;
  },
});

// The document's length, recomputed on doc changes; the same number keeps its identity.
const length = GardState.Field.Derived.define((state) => state.doc.length);

const config = [basicSchema(), counter, entries, length.extension];

const editors = new Map<string, Wordgard>();
const Grab = ({ name }: { name: string }) => {
  const wg = useWordgard();
  useLayoutEffect(() => {
    editors.set(name, wg);
  }, [name, wg]);
  return null;
};

const editor = (name: string) => {
  const wg = editors.get(name);
  if (!wg) throw new Error(`No editor ${name}`);
  return wg;
};

const Editor = ({ name, children }: { name: string; children?: ReactNode }) => (
  <WordgardEditor doc={`<p>${name}</p>`} config={config}>
    <Grab name={name} />
    {children}
    <WordgardDoc />
  </WordgardEditor>
);

const renders: Record<string, unknown[]> = {};
const log = (name: string, value: unknown) => (renders[name] ??= []).push(value);

const Count = () => {
  log("count", useEditorField(counter));
  return null;
};
const Parity = () => {
  log(
    "parity",
    useEditorField(counter, (n) => n % 2)
  );
  return null;
};
const Entry = ({ id }: { id: string }) => {
  log(`entry:${id}`, useEditorFieldEntry(entries, id)?.n);
  return null;
};
const Length = () => {
  log("length", useEditorField(length));
  return null;
};

const Probes = () => (
  <>
    <Count />
    <Parity />
    <Entry id="x" />
    <Entry id="y" />
    <Length />
  </>
);

const run = (wg: Wordgard, spec: Transaction.Spec) => {
  wg.dispatch(spec);
  wg.flush();
};

const reset = () => {
  editors.clear();
  for (const key of Object.keys(renders)) delete renders[key];
};

describe("useEditorField", () => {
  it("re-renders on its own field's change only", async () => {
    reset();
    const root = createRoot(container());
    flushSync(() =>
      root.render(
        <Editor name="a">
          <Probes />
        </Editor>
      )
    );
    await tick();
    const a = editor("a");
    const counts = () => Object.fromEntries(Object.entries(renders).map(([k, v]) => [k, v.length]));
    const start = counts();

    // A selection change: no field changes, nothing re-renders.
    run(a, { selection: { anchor: 2 } });
    expect(counts()).toEqual(start);

    // Typing: only the derived length changes.
    run(a, { changes: { from: 1, insert: [Leaf.text("!")] } });
    expect(renders.length?.at(-1)).toBe(a.state.doc.length);
    expect(counts()).toEqual({ ...start, length: (start.length ?? 0) + 1 });

    // A bump of x: the counter, the parity and entry x, not entry y.
    const before = counts();
    run(a, { effects: bump.of("x") });
    expect(renders.count?.at(-1)).toBe(1);
    expect(renders.parity?.at(-1)).toBe(1);
    expect(renders["entry:x"]?.at(-1)).toBe(1);
    expect(counts()["entry:y"]).toBe(before["entry:y"]);
    expect(counts().length).toBe(before.length);

    // Two bumps of y: parity selects the same value and doesn't re-render.
    const mid = counts();
    run(a, { effects: [bump.of("y"), bump.of("y")] });
    expect(renders.count?.at(-1)).toBe(3);
    expect(counts().parity).toBe(mid.parity);
    expect(renders["entry:y"]?.at(-1)).toBe(2);
    expect(counts()["entry:x"]).toBe(mid["entry:x"]);
    root.unmount();
  });

  it("follows a WordgardScope to another editor", async () => {
    reset();
    const Page = ({ active }: { active: string | null }) => {
      const wg = active == null ? undefined : editors.get(active);
      return (
        <>
          <Editor name="a">
            {wg ? (
              <WordgardScope wg={wg}>
                <Probes />
              </WordgardScope>
            ) : null}
          </Editor>
          <Editor name="bb" />
        </>
      );
    };
    const root = createRoot(container());
    flushSync(() => root.render(<Page active={null} />));
    flushSync(() => root.render(<Page active="a" />));
    await tick();
    const a = editor("a");
    const b = editor("bb");
    run(b, { effects: [bump.of("x"), bump.of("x")] });
    expect(renders.count?.at(-1)).toBe(0);

    flushSync(() => root.render(<Page active="bb" />));
    await tick();
    expect(renders.count?.at(-1)).toBe(2);
    expect(renders["entry:x"]?.at(-1)).toBe(2);
    expect(renders.length?.at(-1)).toBe(b.state.doc.length);

    // Subscribed to b now: a's changes don't reach it, b's do.
    const seen = renders.count?.length;
    run(a, { effects: bump.of("x") });
    expect(renders.count?.length).toBe(seen);
    run(b, { effects: bump.of("y") });
    expect(renders.count?.at(-1)).toBe(3);
    expect(renders["entry:y"]?.at(-1)).toBe(1);
    root.unmount();
  });
});
