// Not in react-wordgard: what svelte-wordgard relies on in Svelte's behaviour, which no contract
// covers (docs: the Svelte plan's Phase 0). Run at every Svelte update: a failure here says which
// assumption broke, before the view's own tests do.
import { flushSync, getAbortSignal, mount, unmount } from "svelte";

import Decoration from "../components/Decoration.svelte";
import { box } from "../helpers/box.svelte.js";
import Attached from "./fixtures/Attached.svelte";
import AttachedSpread from "./fixtures/AttachedSpread.svelte";
import Block from "./fixtures/Block.svelte";
import Dynamic from "./fixtures/Dynamic.svelte";
import DynamicAttached from "./fixtures/DynamicAttached.svelte";
import Effects from "./fixtures/Effects.svelte";
import IfAttached from "./fixtures/IfAttached.svelte";
import Nested from "./fixtures/Nested.svelte";
import Plain from "./fixtures/Plain.svelte";
import SetupThrow from "./fixtures/SetupThrow.svelte";
import Sibling from "./fixtures/Sibling.svelte";

const roots: Record<string, unknown>[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) void unmount(root);
});

// Every microtask queued so far has run.
const microtasks = () => new Promise<void>((resolve) => setTimeout(resolve));

const holderMount = <Props extends Record<string, unknown>>(
  component: Parameters<typeof mount<Props, Record<string, unknown>>>[0],
  props: Props
) => {
  const target = document.body.appendChild(document.createElement("article"));
  const holder = document.createElement("div");
  const anchor = holder.appendChild(document.createTextNode(""));
  const root = mount(component, { target, anchor, props });
  roots.push(root);
  return { target, holder, anchor, root };
};

describe("Svelte, as svelte-wordgard uses it", () => {
  it("mounts before the anchor it's given, adding nothing to the target", () => {
    const { target, holder, anchor } = holderMount(Plain, { n: 1 });
    expect(target.childNodes.length).toBe(0);
    expect(holder.firstChild).toBeInstanceOf(HTMLButtonElement);
    expect(holder.lastChild).toBe(anchor);
  });

  it("updates and unmounts a single-element root moved out of the holder", () => {
    const props = box({ n: 1 });
    const { target, holder, root } = holderMount(Plain, {
      get n() {
        return props.current.n;
      },
    });
    const p = holder.querySelector("button");
    if (!p) throw new Error("No root");
    target.append(p);
    props.current = { n: 2 };
    flushSync();
    expect(target.innerHTML).toBe("<button>2</button>");
    void unmount(root);
    roots.length = 0;
    expect(target.childNodes.length).toBe(0);
  });

  it("draws a root a block replaces in the holder, where an observer sees it", () => {
    const props = box({ show: true });
    const { target, holder } = holderMount(Block, {
      get show() {
        return props.current.show;
      },
    });
    const p = holder.querySelector("p");
    if (!p) throw new Error("No root");
    target.append(p);
    const observer = new MutationObserver(() => {});
    observer.observe(holder, { childList: true });
    props.current = { show: false };
    flushSync();
    expect(target.childNodes.length).toBe(0);
    expect(holder.querySelector("div")?.textContent).toBe("b");
    expect(observer.takeRecords().length).toBeGreaterThan(0);
  });

  it("keeps a <svelte:element>'s comment beside it, and updates it without its inner text node", () => {
    const props = box({ tag: "h1", n: 1 });
    const { target, holder } = holderMount(Dynamic, {
      get tag() {
        return props.current.tag;
      },
      get n() {
        return props.current.n;
      },
    });
    const h1 = holder.querySelector("h1");
    if (!h1) throw new Error("No root");
    expect([...holder.childNodes].some((node) => node instanceof Comment)).toBe(true);
    expect([...h1.childNodes].map((node) => node.nodeName)).toEqual(["#text"]);
    target.append(h1);
    h1.replaceChildren("typed");
    props.current = { tag: "h1", n: 2 };
    flushSync();
    expect(target.innerHTML).toBe('<h1 data-n="2">typed</h1>');
    props.current = { tag: "h2", n: 2 };
    flushSync();
    expect(holder.querySelector("h2")).toBeTruthy();
  });

  it("delivers delegated events through the target, before an ancestor stops them", () => {
    const clicks: string[] = [];
    const { target, holder } = holderMount(Plain, { onclick: () => clicks.push("svelte") });
    const outer = document.body.appendChild(document.createElement("section"));
    outer.append(target);
    outer.addEventListener("click", (event) => {
      clicks.push("outer");
      event.stopPropagation();
    });
    const p = holder.querySelector("button");
    if (!p) throw new Error("No root");
    target.append(p);
    p.click();
    expect(clicks).toEqual(["svelte", "outer"]);
    outer.remove();
  });

  it("runs an attachment before flushSync(fn) returns, not during mount", () => {
    const seen: string[] = [];
    const attach = (element: Element) => {
      seen.push(element.localName);
    };
    holderMount(Attached, { attach });
    expect(seen).toEqual([]);
    flushSync();
    expect(seen).toEqual(["p"]);
    flushSync(() => holderMount(Attached, { attach }));
    expect(seen).toEqual(["p", "p"]);
  });

  it("tells a reaction from outside one with getAbortSignal", () => {
    const inReaction = () => {
      try {
        getAbortSignal();
        return true;
      } catch {
        return false;
      }
    };
    expect(inReaction()).toBe(false);
    const seen: boolean[] = [];
    holderMount(Attached, { attach: () => void seen.push(inReaction()) });
    flushSync();
    expect(seen).toEqual([true]);
  });
  // helpers/mountRoot.ts's `trackRoot`: DecorationRoot's teardown says a root is dead before the
  // holder reads the records of its replacement.
  it("runs a replaced element's attachment teardown inside flushSync", () => {
    const seen: string[] = [];
    const props = box({ tag: "h1" });
    const { holder } = holderMount(DynamicAttached, {
      get tag() {
        return props.current.tag;
      },
      attach: (element: Element) => {
        seen.push(`+${element.localName}`);
        return () => void seen.push(`-${element.localName}`);
      },
    });
    flushSync();
    const observer = new MutationObserver(() => {});
    observer.observe(holder, { childList: true });
    props.current = { tag: "h2" };
    flushSync();
    expect(seen).toEqual(["+h1", "-h1", "+h2"]);
    expect(observer.takeRecords().length).toBeGreaterThan(0);
  });

  // helpers/slot.ts: a content element is drawn again only when the component attaches another.
  // Alone on an element, or beside a spread (DecorationRoot's, a root drawn by hand): Svelte runs
  // them through different code.
  it.each([
    ["alone", Attached],
    ["beside a spread", AttachedSpread],
  ])("runs an attachment %s again only for a new function", (_, component) => {
    const seen: number[] = [];
    const first = () => void seen.push(1);
    const props = box({ n: 1, attach: first });
    holderMount(component, {
      get n() {
        return props.current.n;
      },
      get attach() {
        return props.current.attach;
      },
    });
    flushSync();
    props.current = { n: 2, attach: first };
    flushSync();
    expect(seen).toEqual([1]);
    props.current = { n: 2, attach: () => void seen.push(2) };
    flushSync();
    expect(seen).toEqual([1, 2]);
  });

  // WordgardDoc draws the document from its attachment, and the renderer commits in `flushSync`.
  it("commits a flushSync called from inside an attachment", () => {
    const props = box({ n: 1 });
    const { holder } = holderMount(Plain, {
      get n() {
        return props.current.n;
      },
    });
    const seen: string[] = [];
    holderMount(Attached, {
      attach: () => {
        props.current = { n: 2 };
        flushSync();
        seen.push(holder.querySelector("button")?.textContent ?? "");
      },
    });
    flushSync();
    expect(seen).toEqual(["2"]);
  });

  // helpers/mountRoot.ts: a component throwing in its setup leaves no element and its error comes
  // later, so the holder throws its own first, and unmounts it after the error is reported.
  it("reports a setup error to the boundary's onerror in a microtask, not once unmounted", async () => {
    const errors: unknown[] = [];
    const mountThrowing = () =>
      mount(Decoration, {
        target: document.body,
        anchor: document.body.appendChild(document.createTextNode("")),
        props: {
          drawn: box({ component: SetupThrow, props: {} }),
          onerror: (error: unknown) => errors.push(error),
        },
      });
    roots.push(mountThrowing());
    expect(errors).toEqual([]);
    // As the holder queues its unmount: the error must be reported first.
    const reportedFirst: number[] = [];
    queueMicrotask(() => reportedFirst.push(errors.length));
    await microtasks();
    expect(reportedFirst).toEqual([1]);
    expect(errors.map(String)).toEqual(["Error: SetupThrow"]);
    void unmount(mountThrowing());
    await microtasks();
    expect(errors.length).toBe(1);
  });

  // slot.ts and ChildNodeViews' `defer`: a content element's roots aren't mounted from the
  // attachment that marks it.
  it("stops updating a root mounted in an attachment whose block goes in the same flush", () => {
    const target = document.body.appendChild(document.createElement("section"));
    const inner = box({ n: 1 });
    let mounted: Record<string, unknown> | null = null;
    const outer = box({ show: true });
    holderMount(IfAttached, {
      get show() {
        return outer.current.show;
      },
      attach: () => {
        mounted ??= mount(Plain, {
          target,
          props: {
            get n() {
              return inner.current.n;
            },
          },
        });
      },
    });
    flushSync();
    expect(target.textContent).toBe("1");
    outer.current = { show: false };
    inner.current = { n: 2 };
    flushSync();
    inner.current = { n: 3 };
    flushSync();
    expect(target.textContent).toBe("1");
    if (mounted) void unmount(mounted);
    target.remove();
  });

  // WrappedNode's `$effect.pre` reports its attributes once mounted, and their changes in the flush.
  it("runs $effect.pre as the component is set up, and $effect at the next flush", () => {
    const seen: string[] = [];
    const props = box({ n: 1 });
    holderMount(Effects, {
      get n() {
        return props.current.n;
      },
      log: (what: string) => void seen.push(what),
    });
    expect(seen).toEqual(["pre 1"]);
    flushSync();
    expect(seen).toEqual(["pre 1", "effect 1"]);
    props.current = { n: 2 };
    flushSync();
    expect(seen).toEqual(["pre 1", "effect 1", "pre 2", "effect 2"]);
  });

  // helpers/mountRoot.ts puts a root back in the holder before unmounting it: Svelte removes an
  // effect's nodes from its first to its last, by siblings, wherever the first is.
  it("removes a moved root's following siblings when its effect spans more than it", () => {
    const { target, holder, root } = holderMount(Sibling, { more: true });
    const p = holder.querySelector("p");
    if (!p) throw new Error("No root");
    target.append(p, document.createElement("hr"));
    void unmount(root);
    roots.length = 0;
    expect(target.childNodes.length).toBe(0);
  });

  // DecorationRoot's `trackRoot`: in a `{#key}` around blocks, and under HMR, Svelte leaves the old
  // root where it is when it draws the new one.
  it("leaves the old root of nested blocks in the document when it replaces it", () => {
    const props = box({ k: 1 });
    const { target, holder } = holderMount(Nested, {
      get k() {
        return props.current.k;
      },
    });
    const p = holder.querySelector("p");
    if (!p) throw new Error("No root");
    target.append(p);
    props.current = { k: 2 };
    flushSync();
    expect(target.innerHTML).toBe('<p data-k="1"></p>');
    expect(holder.querySelector("p")?.dataset.k).toBe("2");
  });
});
