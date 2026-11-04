// A WordgardScope gives what it holds another editor: the hooks under it read,
// call and listen to that one, and follow when it changes.
import React, { Component, type ReactNode, createRef, useLayoutEffect } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Leaf } from "wordgard/doc";
import { Wordgard } from "wordgard/editor";
import { basicSchema } from "wordgard/schema";

import { WordgardDoc } from "../components/WordgardDoc.js";
import { WordgardEditor } from "../components/WordgardEditor.js";
import { WordgardScope } from "../components/WordgardScope.js";
import { useEditorEffect } from "../hooks/useEditorEffect.js";
import { useEditorEventCallback } from "../hooks/useEditorEventCallback.js";
import { useEditorStateSelector } from "../hooks/useEditorStateSelector.js";
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
  <WordgardEditor doc={`<p>${name}</p>`} config={[basicSchema()]}>
    <Grab name={name} />
    {children}
    <WordgardDoc />
  </WordgardEditor>
);

const effects: string[] = [];
const seen: string[] = [];
const handles = { call: () => {} };

const Probe = () => {
  const text = useEditorStateSelector((state) => state.doc.textContent());
  const wg = useWordgard();
  const call = useEditorEventCallback((editor) => {
    editor.dispatch({ changes: { from: 1, insert: [Leaf.text("!")] } });
  });
  useLayoutEffect(() => {
    handles.call = call;
  });
  useEditorEffect((editor) => {
    effects.push(editor.state.doc.textContent());
  }, []);
  seen.push(`${text}:${wg.state.doc.textContent()}`);
  return null;
};

// React 18 rethrows a render error from flushSync, React 19 reports it to the
// root instead: a boundary catches it in both.
class Catch extends Component<{ children: ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null };
  static getDerivedStateFromError = (error: unknown) => ({ error });
  render = () => (this.state.error ? null : this.props.children);
}

const Page = ({ active }: { active: string | null }) => {
  const wg = active == null ? undefined : editors.get(active);
  return (
    <>
      <Editor name="a">
        {wg ? (
          <WordgardScope wg={wg}>
            <Probe />
          </WordgardScope>
        ) : null}
      </Editor>
      <Editor name="b" />
    </>
  );
};

describe("WordgardScope", () => {
  it("gives its hooks the editor it names, and follows it", async () => {
    editors.clear();
    effects.length = 0;
    const root = createRoot(container());
    // The editors exist once rendered: render again to scope the probe.
    flushSync(() => root.render(<Page active={null} />));
    flushSync(() => root.render(<Page active="b" />));
    await tick();
    expect(seen.at(-1)).toBe("b:b");
    expect(effects.at(-1)).toBe("b");

    const b = editor("b");
    flushSync(() => handles.call());
    b.flush();
    await tick();
    expect(b.state.doc.textContent()).toBe("!b");
    expect(seen.at(-1)).toBe("!b:!b");
    expect(editor("a").state.doc.textContent()).toBe("a");

    flushSync(() => root.render(<Page active="a" />));
    await tick();
    expect(seen.at(-1)).toBe("a:a");
    expect(effects.at(-1)).toBe("a");
    root.unmount();
  });

  it("refuses an editor react-wordgard doesn't drive", () => {
    const plain = Wordgard.create({
      doc: "<p>x</p>",
      config: [basicSchema()],
      parent: container(),
    });
    const boundary = createRef<Catch>();
    const root = createRoot(container());
    flushSync(() =>
      root.render(
        <Catch ref={boundary}>
          <WordgardScope wg={plain} />
        </Catch>
      )
    );
    const error = boundary.current?.state.error;
    expect(error instanceof Error ? error.message : "").toMatch(/WordgardEditor/);
    root.unmount();
  });
});
