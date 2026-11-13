// Not in react-wordgard, where React draws a decoration's component in its tree. A Svelte component
// is a root of its own (`mount`), its contexts given by hand. Its anchor is in a detached holder,
// so what Svelte puts beside a root (the anchor, a block's comment, its boundary's) stays out of
// the document, and the root is moved into place. The content element is the mount's target, for
// Svelte's delegated events: they listen on the target and on `document`, and an ancestor
// stopping an event would otherwise silence them.
import { type Component, mount, unmount } from "svelte";
import type { Attachment } from "svelte/attachments";

import type { Words } from "@stesura/wordgard-view";
import Decoration from "../components/Decoration.svelte";
import { type Box, box } from "./box.svelte.js";

// Svelte's component type takes its props contravariantly: the registries
// hold components of any props.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyComponent = Component<any>;

// The roots DecorationRoot drew that Svelte has destroyed since. One still in
// the document was replaced from inside nested blocks (the component's and
// DecorationRoot's under HMR), which Svelte leaves where they are.
const destroyed = new WeakSet<Element>();

export const trackRoot: Attachment<Element> = (element) => () => {
  destroyed.add(element);
};

export type Drawn = {
  readonly component: AnyComponent;
  readonly props: Record<string, unknown>;
};

export type Mounted = {
  // The component's one root element.
  root: Element;
  readonly drawn: Box<Drawn>;
  // Given the root Svelte drew in the holder in its place: a block at the top
  // switching, `<svelte:element>`'s tag changing, an HMR update. Returns what
  // puts it in the old one's place, run once every replaced root is known.
  replaced: (root: Element) => () => void;
  readonly destroy: () => void;
};

// A component mounted without a root element.
export type Bare = {
  readonly drawn: Box<Drawn>;
  readonly destroy: () => void;
};

export type Holder = {
  // Where the anchors are, and what Svelte puts beside the roots.
  readonly element: Element;
  // Mounts `drawn`, `what` naming it for errors ("shape").
  readonly mount: (
    drawn: Drawn,
    what: string,
    context: Map<unknown, unknown>,
    onerror: (error: unknown) => void
  ) => Mounted;
  // Mounts `drawn`, which draws no element (a node wrapper).
  readonly mountBare: (
    drawn: Drawn,
    context: Map<unknown, unknown>,
    onerror: (error: unknown) => void
  ) => Bare;
  // Hands the roots replaced since to their `replaced`.
  readonly take: () => void;
  // Whether any component is mounted.
  readonly mounted: () => boolean;
};

// `drain` draws what waits for the components' effects (content elements),
// before replaced roots go into the document: there, Wordgard's observer
// would take content moved into them for typing.
export const createHolder = (target: Element, words: Words, drain: () => void): Holder => {
  const holder = target.ownerDocument.createElement("div");
  const anchors = new Map<Node, Mounted>();
  // The anchors of components without a root, and where their errors go.
  const bare = new Map<Node, (error: unknown) => void>();
  // The elements a component drew before its anchor.
  const rootsBefore = (anchor: Node) => {
    const found: Element[] = [];
    for (
      let at = anchor.previousSibling;
      at && !anchors.has(at) && !bare.has(at);
      at = at.previousSibling
    )
      if (at instanceof Element) found.push(at);
    return found;
  };
  const sort = (records: readonly MutationRecord[]) => {
    const changed = new Set<Mounted>();
    for (const record of records)
      for (const node of record.addedNodes) {
        if (!(node instanceof Element) || node.parentNode != holder) continue;
        for (let at = node.nextSibling; at; at = at.nextSibling) {
          const mounted = anchors.get(at);
          const onerror = bare.get(at);
          if (onerror) onerror(bareError());
          else if (!mounted) continue;
          else changed.add(mounted);
          break;
        }
      }
    // Placing a root places its siblings' parts too: all the roots first.
    const places: (() => void)[] = [];
    for (const mounted of changed) {
      const [root] = rootsBefore(anchorOf.get(mounted) ?? holder);
      if (!root || root == mounted.root) continue;
      // Svelte removes the root it replaces: one still placed means the
      // component drew a second element, or replaced a root drawn in nested
      // blocks (`{#key}{#if}`), whose old element Svelte leaves where it is.
      // A dead DecorationRoot's is replaced in place.
      if (mounted.root.parentNode && !destroyed.has(mounted.root))
        errors.get(mounted)?.(rootError(whats.get(mounted) ?? ""));
      else {
        homes.set(mounted, root.nextSibling);
        places.push(mounted.replaced(root));
      }
    }
    if (places.length) drain();
    for (const place of places) place();
  };
  const rootError = (what: string) =>
    new Error(`A ${words.name} ${what}'s component must ${words.root}`);
  const bareError = () =>
    new Error(`A ${words.name} node wrapper draws no element: its root is a WrappedNode`);
  const anchorOf = new WeakMap<Mounted, Node>();
  // What followed each root in the holder before it was moved out.
  const homes = new WeakMap<Mounted, Node | null>();
  const whats = new WeakMap<Mounted, string>();
  const errors = new WeakMap<Mounted, (error: unknown) => void>();
  const observer = new MutationObserver(sort);
  observer.observe(holder, { childList: true });
  return {
    mount: (drawn, what, context, onerror) => {
      const anchor = holder.appendChild(target.ownerDocument.createTextNode(""));
      const state = box(drawn);
      const instance = mount(Decoration, {
        target,
        anchor,
        props: { drawn: state, onerror },
        context,
      });
      const roots = rootsBefore(anchor);
      const [root] = roots;
      const destroy = () => {
        anchors.delete(anchor);
        // Back where Svelte drew it: Svelte removes an effect's nodes from its
        // first to its last, by siblings, and a root in the document among
        // them would have it remove the document's nodes after it.
        const home = homes.get(mounted);
        if (home?.parentNode == holder && mounted.root.parentNode != holder)
          holder.insertBefore(mounted.root, home);
        void unmount(instance);
        // Svelte removes a root it placed through a block (`<svelte:element>`,
        // the boundary) from the holder only.
        mounted.root.remove();
        anchor.remove();
      };
      const mounted: Mounted = {
        root: root ?? target.ownerDocument.createElement("span"),
        drawn: state,
        replaced: () => () => {},
        destroy,
      };
      // No element is also what a component throwing in its setup leaves: its
      // boundary reports the error a microtask later, to `onerror`, unless
      // unmounted by then. With elements, its effects would run meanwhile.
      if (roots.length != 1 || !root) {
        if (root) destroy();
        else queueMicrotask(destroy);
        throw rootError(what);
      }
      homes.set(mounted, root.nextSibling);
      anchors.set(anchor, mounted);
      anchorOf.set(mounted, anchor);
      whats.set(mounted, what);
      errors.set(mounted, onerror);
      return mounted;
    },
    mountBare: (drawn, context, onerror) => {
      const anchor = holder.appendChild(target.ownerDocument.createTextNode(""));
      const state = box(drawn);
      const instance = mount(Decoration, {
        target,
        anchor,
        props: { drawn: state, onerror },
        context,
      });
      const destroy = () => {
        bare.delete(anchor);
        void unmount(instance);
        anchor.remove();
      };
      if (rootsBefore(anchor).length) {
        destroy();
        throw bareError();
      }
      bare.set(anchor, onerror);
      return { drawn: state, destroy };
    },
    element: holder,
    take: () => sort(observer.takeRecords()),
    mounted: () => anchors.size + bare.size > 0,
  };
};
