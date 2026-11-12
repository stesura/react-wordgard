// Not in react-wordgard: what svelte-wordgard relies on in Svelte's behaviour, which no contract
// covers (docs: the Svelte plan's Phase 0). Run at every Svelte update: a failure here says which
// assumption broke, before the view's own tests do.
import { flushSync, getAbortSignal, mount, unmount } from "svelte";

import { box } from "../helpers/box.svelte.js";
import Attached from "./fixtures/Attached.svelte";
import Block from "./fixtures/Block.svelte";
import Dynamic from "./fixtures/Dynamic.svelte";
import Plain from "./fixtures/Plain.svelte";

const roots: Record<string, unknown>[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) void unmount(root);
});

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
});
