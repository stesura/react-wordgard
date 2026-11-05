// An editor in the app's React tree (WordgardEditor, WordgardDoc), and the hooks over it.
import React, {
  Component,
  type ReactNode,
  StrictMode,
  createContext,
  createRef,
  forwardRef,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Leaf, Plot } from "wordgard/doc";
import { Decoration, Widget, Wordgard } from "wordgard/editor";
import { basicSchema, blockquote, bulletList, image } from "wordgard/schema";
import { GardState, type Transaction } from "wordgard/state";
import { Image, Paragraph, Strong } from "wordgard/types";

import { WordgardDoc } from "../components/WordgardDoc.js";
import { WordgardEditor } from "../components/WordgardEditor.js";
import { createWidgetTypeWithRender } from "../decorations/ReactWidgetType.js";
import { useEditorEffect } from "../hooks/useEditorEffect.js";
import { useEditorEventCallback } from "../hooks/useEditorEventCallback.js";
import { useEditorLayoutEffect } from "../hooks/useEditorLayoutEffect.js";
import { useEditorState } from "../hooks/useEditorState.js";
import { useEditorStateSelector } from "../hooks/useEditorStateSelector.js";
import { useWordgard } from "../hooks/useWordgard.js";
import { renderedLists, renderedNodes } from "../testing/renders.js";
import { docTileOf, drawing } from "../testing/tiles.js";
import { ReactDocTile } from "../tile.js";

const img = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

// An inline plot, which Wordgard draws between two `wg-buffer` images.
const Chip = Plot.define("Chip", {
  inline: true,
  inlineContent: true,
  shape: { element: "span", attributes: { class: "chip" } },
  parseRules: [{ selector: "span.chip" }],
});

const label = (text: string) =>
  Object.assign(document.createElement("span"), { className: "w", textContent: text });
const LabelView = forwardRef<HTMLSpanElement, { value: string }>(({ value }, ref) => (
  <span ref={ref} className="w">
    {value}
  </span>
));
const ReactLabel = createWidgetTypeWithRender({ render: label, component: LabelView });
const NativeLabel = Widget.define<string>({ render: label });

// Marks, an image, a line break, a link and an inline plot, with React and
// native widgets.
const doc =
  `<p>plain <em>em</em> <strong>bold <a href="https://x.example">link</a></strong> <img src="${img}"> and<br>break</p>` +
  '<p>a <span class="chip">chip <em>b</em></span> c</p><p></p>';
const config: GardState.Extension = [
  basicSchema(),
  image(),
  GardState.schemaElement.of(Chip),
  Decoration.Tag.widget(Paragraph, "start", ReactLabel.of("|")),
  Decoration.Tag.widget(Paragraph, "end", NativeLabel.of("¶")),
];

const imageSize = document.createElement("style");
imageSize.textContent = "img[src] { width: 20px; height: 20px; }";
document.head.appendChild(imageSize);

const containers: HTMLElement[] = [];
afterEach(() => {
  for (const container of containers.splice(0)) container.remove();
});

const container = () => {
  const dom = document.createElement("div");
  dom.style.cssText = "position: absolute; left: 0; top: 0; width: 300px;";
  document.body.appendChild(dom);
  containers.push(dom);
  return dom;
};

// The editor a component is drawn under, for the test to drive.
const editors: Wordgard[] = [];
const Grab = () => {
  const wg = useWordgard();
  useLayoutEffect(() => {
    editors.push(wg);
  }, [wg]);
  return null;
};

const render = (ui: ReactNode) => {
  editors.length = 0;
  const root = createRoot(container());
  flushSync(() => root.render(ui));
  const wg = editors.at(-1);
  if (!wg) throw new Error("No editor");
  return { wg, root };
};

// React 18 rethrows a render error from flushSync, React 19 reports it to the
// root instead: a boundary catches it in both.
class Catch extends Component<{ children: ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null };
  static getDerivedStateFromError = (error: unknown) => ({ error });
  render = () => (this.state.error ? null : this.props.children);
}
const errorOf = (boundary: Catch | null) => {
  const error = boundary?.state.error;
  return error instanceof Error ? error.message : "";
};

const hosted = (children: ReactNode = null, extra: GardState.Extension = []) =>
  render(
    <WordgardEditor doc={doc} config={[config, extra]}>
      <Grab />
      {children}
      <WordgardDoc className="host" />
    </WordgardEditor>
  );

const plain = (extra: GardState.Extension = []) => {
  const wg = Wordgard.create({ doc, config: [config, extra], parent: container() });
  wg.flush();
  return wg;
};

// Effects run in a microtask when the editor is idle; frames bring Wordgard's
// own flushes.
const tick = () => new Promise<void>((resolve) => queueMicrotask(resolve));
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const edit = (wg: Wordgard, spec: Transaction.Spec) => {
  wg.dispatch(spec);
  wg.flush();
};

const steps: Transaction.Spec[] = [
  { changes: { from: 9, insert: [Leaf.text("x")] } },
  { changes: { from: 2, insert: [Image.of(`${img}#2`)] } },
  { changes: { from: 1, to: 12, add: Strong } },
  {
    changes: {
      from: 0,
      insert: [Paragraph.create([Leaf.text("new "), Leaf.text("one", [Strong])])],
    },
  },
  // Across the mark boundary in the new paragraph.
  { changes: { from: 2, to: 6 } },
];

describe("WordgardEditor", () => {
  it("draws the document through the app's tree as Wordgard draws it", () => {
    const { wg } = hosted();
    expect(wg.connected).toBe(true);
    expect(wg.contentDOM.wgTile).toBeInstanceOf(ReactDocTile);
    expect(wg.dom.parentElement?.className).toBe("host");
    expect(drawing(wg)).toEqual(drawing(plain()));
  });

  it("keeps matching Wordgard through edits", () => {
    const { wg } = hosted();
    const reference = plain();
    for (const spec of steps) {
      edit(wg, spec);
      edit(reference, spec);
      expect(drawing(wg)).toEqual(drawing(reference));
    }
  });

  it("matches Wordgard in StrictMode", () => {
    const { wg } = render(
      <StrictMode>
        <WordgardEditor doc={doc} config={config}>
          <Grab />
          <WordgardDoc />
        </WordgardEditor>
      </StrictMode>
    );
    const reference = plain();
    expect(drawing(wg)).toEqual(drawing(reference));
    for (const spec of steps) {
      edit(wg, spec);
      edit(reference, spec);
      expect(drawing(wg)).toEqual(drawing(reference));
    }
  });

  it("connects widgets once, when the editor is in the page", () => {
    const run = (mount: (extra: GardState.Extension) => Wordgard) => {
      const log: string[] = [];
      const Tracked = createWidgetTypeWithRender({
        render: label,
        component: LabelView,
        connect: (value) => log.push(`connect ${value}`),
        disconnect: (value) => log.push(`disconnect ${value}`),
      });
      const wg = mount(Decoration.Tag.widget(Paragraph, "after", Tracked.of("t")));
      log.push("|");
      edit(wg, { changes: { from: 0, insert: [Paragraph.create([Leaf.text("x")])] } });
      return log;
    };
    expect(run((extra) => hosted(null, extra).wg)).toEqual(run(plain));
  });

  it("draws the document again when WordgardDoc is mounted again", () => {
    let show: (on: boolean) => void = () => {};
    const Toggle = () => {
      const [on, setOn] = useState(true);
      useLayoutEffect(() => {
        show = (on) => flushSync(() => setOn(on));
      }, []);
      return on ? <WordgardDoc /> : null;
    };
    const { wg } = render(
      <WordgardEditor doc={doc} config={config}>
        <Grab />
        <Toggle />
      </WordgardEditor>
    );
    show(false);
    expect(wg.connected).toBe(false);
    show(true);
    expect(wg.connected).toBe(true);
    const reference = plain();
    expect(drawing(wg)).toEqual(drawing(reference));
    edit(wg, steps[0] ?? {});
    edit(reference, steps[0] ?? {});
    expect(drawing(wg)).toEqual(drawing(reference));
  });

  it("refuses a second WordgardDoc for one editor", () => {
    const boundary = createRef<Catch>();
    render(
      <WordgardEditor doc={doc} config={config}>
        <Grab />
        <Catch ref={boundary}>
          <WordgardDoc />
          <WordgardDoc />
        </Catch>
      </WordgardEditor>
    );
    expect(errorOf(boundary.current)).toMatch(/already rendered by another WordgardDoc/);
  });

  it("refuses a WordgardDoc added for an editor already rendered", () => {
    let add: () => void = () => {};
    const Second = () => {
      const [on, setOn] = useState(false);
      useLayoutEffect(() => {
        add = () => flushSync(() => setOn(true));
      }, []);
      return on ? <WordgardDoc /> : null;
    };
    const boundary = createRef<Catch>();
    render(
      <WordgardEditor doc={doc} config={config}>
        <Grab />
        <WordgardDoc />
        <Catch ref={boundary}>
          <Second />
        </Catch>
      </WordgardEditor>
    );
    add();
    expect(errorOf(boundary.current)).toMatch(/already rendered by another WordgardDoc/);
  });

  it("gives React widgets the app's contexts, which may change outside the flush", () => {
    const Theme = createContext("none");
    const Themed = forwardRef<HTMLSpanElement, { value: string }>(({ value }, ref) => (
      <span ref={ref} className="w">
        {`${useContext(Theme)}:${value}`}
      </span>
    ));
    const ThemedLabel = createWidgetTypeWithRender({ render: label, component: Themed });
    let setTheme: (theme: string) => void = () => {};
    const App = () => {
      const [theme, set] = useState("light");
      useLayoutEffect(() => {
        setTheme = (theme) => flushSync(() => set(theme));
      }, []);
      return (
        <Theme.Provider value={theme}>
          <WordgardEditor
            doc="<p>a<strong>b</strong></p>"
            config={[basicSchema(), Decoration.Tag.widget(Paragraph, "start", ThemedLabel.of("x"))]}
          >
            <Grab />
            <WordgardDoc />
          </WordgardEditor>
        </Theme.Provider>
      );
    };
    const { wg } = render(<App />);
    const widget = wg.contentDOM.querySelector(".w");
    expect(widget?.textContent).toBe("light:x");
    const tile = docTileOf(wg);
    setTheme("dark");
    wg.flush();
    expect(wg.contentDOM.querySelector(".w")).toBe(widget);
    expect(widget?.textContent).toBe("dark:x");
    expect(docTileOf(wg)).toBe(tile);
  });
});

describe("renders", () => {
  it("renders only the block typed in and its ancestors, from the first keystroke", () => {
    const { wg } = render(
      <WordgardEditor
        doc="<p>one</p><blockquote><p>two</p></blockquote><ul><li><p>three</p></li></ul>"
        config={[basicSchema(), blockquote(), bulletList()]}
      >
        <Grab />
        <WordgardDoc />
      </WordgardEditor>
    );
    const typed = (from: number) => {
      edit(wg, { changes: { from, insert: [Leaf.text("x")] } });
      return renderedNodes(wg.dom).map((node) => node.name);
    };
    expect(typed(16)).toEqual(["BulletList", "ListItem", "Paragraph"]);
    expect(typed(17)).toEqual(["BulletList", "ListItem", "Paragraph"]);
    expect(typed(8)).toEqual(["Blockquote", "Paragraph"]);
    expect(typed(2)).toEqual(["Paragraph"]);
    expect(
      wg.state.doc.content.map((node) => (node instanceof Plot ? node.textContent() : ""))
    ).toEqual(["oxne", "txwo", "txxhree"]);
  });

  it("renders no list but the text's for a keystroke, and the lists whose shape changes", () => {
    const { wg } = render(
      <WordgardEditor
        doc="<p>one</p><blockquote><p>two</p><p>three</p></blockquote><p>four</p>"
        config={[basicSchema(), blockquote()]}
      >
        <Grab />
        <WordgardDoc />
      </WordgardEditor>
    );
    const lists = (spec: Transaction.Spec) => {
      edit(wg, spec);
      return renderedLists(wg.dom);
    };
    expect(lists({ changes: { from: 2, insert: [Leaf.text("x")] } })).toBe(1);
    expect(lists({ changes: { from: 9, insert: [Leaf.text("x")] } })).toBe(1);
    // A paragraph more in the blockquote: its list, not the document's.
    expect(lists({ changes: { from: 7, insert: [Paragraph.create([Leaf.text("new")])] } })).toBe(2);
    expect(lists({ changes: { from: 0, insert: [Paragraph.create([Leaf.text("top")])] } })).toBe(2);
    expect(wg.contentDOM.textContent).toBe("topoxnenewtxwothreefour");
  });
});

describe("hooks", () => {
  it("useEditorState and useEditorStateSelector give the flushed state", () => {
    const states: GardState[] = [];
    const blocks: number[] = [];
    const typed: string[] = [];
    const Whole = () => {
      const state = useEditorState();
      const wg = useWordgard();
      useLayoutEffect(() => {
        states.push(state);
        // In the same commit as the document.
        typed.push(wg.contentDOM.textContent ?? "");
      });
      return null;
    };
    const Blocks = () => {
      const count = useEditorStateSelector((state) => state.doc.content.length);
      useLayoutEffect(() => {
        blocks.push(count);
      });
      return null;
    };
    const { wg } = hosted(
      <>
        <Whole />
        <Blocks />
      </>
    );
    expect(states).toEqual([wg.state]);
    wg.dispatch({ changes: { from: 1, insert: [Leaf.text("Q")] } });
    expect(states).toHaveLength(1);
    wg.flush();
    expect(states.at(-1)).toBe(wg.state);
    expect(typed.at(-1)).toContain("Qplain");
    edit(wg, { selection: { anchor: 3 } });
    expect(states).toHaveLength(3);
    edit(wg, { changes: { from: 0, insert: [Paragraph.create([Leaf.text("new")])] } });
    expect(blocks).toEqual([3, 4]);
  });

  it("useEditorStateSelector takes a selector building an object, and an isEqual", () => {
    const renders: number[] = [];
    const heads: number[][] = [];
    const Blocks = () => {
      const { count } = useEditorStateSelector(
        (state) => ({ count: state.doc.content.length }),
        (a, b) => a.count == b.count
      );
      useLayoutEffect(() => {
        renders.push(count);
      });
      return null;
    };
    const Head = () => {
      const head = useEditorStateSelector((state) => [state.selection.head]);
      useLayoutEffect(() => {
        heads.push(head);
      });
      return null;
    };
    const { wg } = hosted(
      <>
        <Blocks />
        <Head />
      </>
    );
    edit(wg, { selection: { anchor: 3 } });
    expect(renders).toEqual([3]);
    expect(heads.at(-1)).toEqual([3]);
    edit(wg, { changes: { from: 0, insert: [Paragraph.create([Leaf.text("new")])] } });
    expect(renders).toEqual([3, 4]);
  });

  it("useEditorEffect runs once the DOM is up to date, and may dispatch", async () => {
    const seen: (string | null)[] = [];
    const Probe = () => {
      const state = useEditorState();
      useEditorEffect(
        (wg) => {
          // Tiles over the new DOM, and the editor in the page.
          seen.push(wg.domAtPos(1, 1).node.textContent);
          if (state.doc.content.length == 4) wg.dispatch({ selection: { anchor: 2 } });
        },
        [state]
      );
      return null;
    };
    // Before WordgardDoc: its first effect waits for the editor to be drawn.
    const { wg } = hosted(<Probe />);
    expect(seen).toEqual([]);
    await tick();
    expect(seen).toEqual(["plain "]);
    edit(wg, { changes: { from: 0, insert: [Paragraph.create([Leaf.text("xy")])] } });
    expect(seen.at(-1)).toBe("xy");
    expect(wg.contentDOM.firstElementChild?.textContent).toBe("|xy¶");
    wg.flush();
    expect(wg.state.selection.from).toBe(2);
  });

  it("useEditorEffect, mounted while the editor is idle, may dispatch and read layout", async () => {
    const lefts: number[] = [];
    const probe = { show: () => {} };
    const Late = () => {
      useEditorEffect((wg) => {
        wg.dispatch({ changes: { from: 1, insert: [Leaf.text("z")] } });
        lefts.push(wg.coordsAtPos(2).left);
      }, []);
      return null;
    };
    const Toggle = () => {
      const [on, setOn] = useState(false);
      useLayoutEffect(() => {
        probe.show = () => flushSync(() => setOn(true));
      }, []);
      return on ? <Late /> : null;
    };
    const { wg } = hosted(<Toggle />);
    const reference = plain();
    probe.show();
    await tick();
    expect(lefts).toHaveLength(1);
    edit(reference, { changes: { from: 1, insert: [Leaf.text("z")] } });
    expect(drawing(wg)).toEqual(drawing(reference));
  });

  it("useEditorEffect runs after a flush that an update listener follows with a dispatch", () => {
    const seen: number[] = [];
    const Probe = () => {
      const blocks = useEditorStateSelector((state) => state.doc.content.length);
      useEditorEffect(() => {
        seen.push(blocks);
      }, [blocks]);
      return null;
    };
    // Moves the selection after every document change: `wg.state` is then
    // ahead of what the DOM shows, until the next flush.
    const follow = Wordgard.updateListener.of((update) => {
      if (update.docChanged) update.editor.dispatch({ selection: { anchor: 1 } });
    });
    const { wg } = hosted(<Probe />, follow);
    edit(wg, { changes: { from: 0, insert: [Paragraph.create([Leaf.text("new")])] } });
    expect(seen.at(-1)).toBe(4);
  });

  it("useEditorEffect cleans up and runs again when its dependencies change", () => {
    const log: string[] = [];
    const Probe = () => {
      const blocks = useEditorStateSelector((state) => state.doc.content.length);
      useEditorEffect(() => {
        log.push(`run ${blocks}`);
        return () => log.push(`clean ${blocks}`);
      }, [blocks]);
      return null;
    };
    const { wg, root } = hosted(<Probe />);
    edit(wg, { changes: { from: 1, insert: [Leaf.text("x")] } });
    edit(wg, { changes: { from: 0, insert: [Paragraph.create([Leaf.text("new")])] } });
    flushSync(() => root.unmount());
    expect(log).toEqual(["run 3", "clean 3", "run 4", "clean 4"]);
  });

  it("useEditorEventCallback is stable and gets the editor", () => {
    const callbacks: ((at: number) => number)[] = [];
    const Probe = () => {
      useEditorState();
      const nodeSize = useEditorEventCallback(
        (wg, at: number) => wg.state.doc.content[at]?.length ?? 0
      );
      useLayoutEffect(() => {
        callbacks.push(nodeSize);
      });
      return null;
    };
    const { wg } = hosted(<Probe />);
    edit(wg, { changes: { from: 1, insert: [Leaf.text("xx")] } });
    expect(callbacks).toHaveLength(2);
    expect(callbacks[0]).toBe(callbacks[1]);
    expect(callbacks[0]?.(0)).toBe(wg.state.doc.content[0]?.length);
  });

  it("useEditorLayoutEffect writes on the same paint as the document update", () => {
    const reads: number[] = [];
    // A widget showing the height of the paragraph it starts.
    const Height = forwardRef<HTMLSpanElement, { value: string }>(({ value }, ref) => {
      const [height, setHeight] = useState(0);
      useEditorLayoutEffect({
        read: (wg) => {
          const height = wg.contentDOM.firstElementChild?.getBoundingClientRect().height ?? 0;
          reads.push(height);
          return height;
        },
        write: (height) => setHeight(height),
      });
      return (
        <span ref={ref} className="h">
          {`${value}${height}`}
        </span>
      );
    });
    const HeightLabel = createWidgetTypeWithRender({ render: label, component: Height });
    const { wg } = render(
      <WordgardEditor
        doc="<p>one</p>"
        config={[basicSchema(), Decoration.Tag.widget(Paragraph, "start", HeightLabel.of("h"))]}
      >
        <Grab />
        <WordgardDoc />
      </WordgardEditor>
    );
    wg.flush();
    const first = wg.contentDOM.firstElementChild?.getBoundingClientRect().height ?? 0;
    expect(wg.contentDOM.querySelector(".h")?.textContent).toBe(`h${first}`);
    const tile = docTileOf(wg);
    edit(wg, { changes: { from: 4, insert: [Leaf.text(" two".repeat(40))] } });
    const second = wg.contentDOM.firstElementChild?.getBoundingClientRect().height ?? 0;
    expect(second).toBeGreaterThan(first);
    expect(wg.contentDOM.querySelector(".h")?.textContent).toBe(`h${second}`);
    expect(reads.at(-1)).toBe(second);
    expect(docTileOf(wg)).not.toBe(tile);
  });

  it("useEditorLayoutEffect skips the write when every read returns undefined", () => {
    const writes: number[] = [];
    // Writes the paragraph count, only when it changed since the last write.
    const Count = () => {
      const last = useRef(-1);
      useEditorLayoutEffect({
        read: (wg) => {
          const count = wg.contentDOM.children.length;
          return count == last.current ? undefined : count;
        },
        write: (count) => {
          last.current = count;
          writes.push(count);
        },
      });
      return null;
    };
    const { wg } = render(
      <WordgardEditor doc="<p>one</p>" config={[basicSchema()]}>
        <Grab />
        <Count />
        <WordgardDoc />
      </WordgardEditor>
    );
    wg.flush();
    expect(writes).toEqual([1]);
    const schedule = vi.spyOn(wg, "scheduleDOMWrite");
    edit(wg, { changes: { from: 2, insert: [Leaf.text("x")] } });
    expect(writes).toEqual([1]);
    expect(schedule).not.toHaveBeenCalled();
    // A new paragraph: written in the same flush.
    edit(wg, { changes: { from: wg.state.doc.length, insert: [Paragraph.create()] } });
    expect(writes).toEqual([1, 2]);
    expect(schedule).toHaveBeenCalledTimes(1);
    schedule.mockRestore();
  });

  it("refuses to update from inside a React effect, with an error saying why", async () => {
    const errors: string[] = [];
    const probe = { update: () => {} };
    const Probe = () => {
      const wg = useWordgard();
      const [count, setCount] = useState(0);
      useLayoutEffect(() => {
        probe.update = () => flushSync(() => setCount((count) => count + 1));
      }, []);
      useLayoutEffect(() => {
        if (!count) return;
        wg.dispatch({ changes: { from: 1, insert: [Leaf.text("x")] } });
        try {
          wg.coordsAtPos(1);
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
        }
      }, [count, wg]);
      return null;
    };
    const { wg } = hosted(<Probe />);
    const reference = plain();
    probe.update();
    expect(errors).toEqual([expect.stringMatching(/can't update while React renders/)]);
    // Wordgard's next frame catches up.
    await frame();
    await frame();
    edit(reference, { changes: { from: 1, insert: [Leaf.text("x")] } });
    expect(drawing(wg)).toEqual(drawing(reference));
  });

  it("catches up on an update refused in one block after an edit in another", async () => {
    const probe = { update: () => {} };
    const Probe = () => {
      const wg = useWordgard();
      const [count, setCount] = useState(0);
      useLayoutEffect(() => {
        probe.update = () => flushSync(() => setCount((count) => count + 1));
      }, []);
      useLayoutEffect(() => {
        if (!count) return;
        wg.dispatch({ changes: { from: 1, insert: [Leaf.text("x")] } });
        expect(() => wg.coordsAtPos(1)).toThrow(/can't update while React renders/);
      }, [count, wg]);
      return null;
    };
    const { wg } = hosted(<Probe />);
    const reference = plain();
    // Where the second paragraph's text starts.
    const second = (wg: Wordgard) => (wg.state.doc.content[0]?.length ?? 0) + 1;
    edit(wg, { changes: { from: second(wg), insert: [Leaf.text("y")] } });
    probe.update();
    edit(wg, { changes: { from: second(wg) + 1, insert: [Leaf.text("z")] } });
    await frame();
    await frame();
    edit(reference, { changes: { from: second(reference), insert: [Leaf.text("yz")] } });
    edit(reference, { changes: { from: 1, insert: [Leaf.text("x")] } });
    expect(drawing(wg)).toEqual(drawing(reference));
    expect(wg.state.doc.eq(reference.state.doc)).toBe(true);
  });

  it("selects through the state the hooks read", () => {
    const Selection = () => {
      const from = useEditorStateSelector((state) => state.selection.from);
      return <output>{from}</output>;
    };
    const { wg } = hosted(<Selection />);
    edit(wg, { selection: { anchor: 4 } });
    expect(document.querySelector("output")?.textContent).toBe("4");
  });
});
