// Not in react-wordgard, where React draws a decoration's component in its tree. A Svelte component
// is a root of its own (`mount`), its contexts given by hand. Its anchor is in a detached holder,
// so what Svelte puts beside a root (the anchor, a block's comment, its boundary's) stays out of
// the document, and the root is moved into place. The content element is the mount's target, for
// Svelte's delegated events: they listen on the target and on `document`, and an ancestor
// stopping an event would otherwise silence them.
import { type Component, mount, unmount } from "svelte";

import type { Words } from "@stesura/wordgard-view";
import Decoration from "../components/Decoration.svelte";
import { type Box, box } from "./box.svelte.js";

// Svelte's component type takes its props contravariantly: the registries
// hold components of any props.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyComponent = Component<any>;

export type Drawn = {
  readonly component: AnyComponent;
  readonly props: Record<string, unknown>;
};

export type Mounted = {
  // The component's one root element.
  root: Element;
  readonly drawn: Box<Drawn>;
  // Given the root Svelte drew in the holder in its place: a block at the top
  // switching, `<svelte:element>`'s tag changing, an HMR update.
  replaced: (root: Element) => void;
  readonly destroy: () => void;
};

export type Holder = {
  // Mounts `drawn`, `what` naming it for errors ("shape").
  readonly mount: (
    drawn: Drawn,
    what: string,
    context: Map<unknown, unknown>,
    onerror: (error: unknown) => void
  ) => Mounted;
  // Hands the roots replaced since to their `replaced`.
  readonly take: () => void;
  // Whether any component is mounted.
  readonly mounted: () => boolean;
};

export const createHolder = (target: Element, words: Words): Holder => {
  const holder = target.ownerDocument.createElement("div");
  const anchors = new Map<Node, Mounted>();
  // The elements a component drew before its anchor.
  const rootsBefore = (anchor: Node) => {
    const found: Element[] = [];
    for (let at = anchor.previousSibling; at && !anchors.has(at); at = at.previousSibling)
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
          if (!mounted) continue;
          changed.add(mounted);
          break;
        }
      }
    for (const mounted of changed) {
      const [root] = rootsBefore(anchorOf.get(mounted) ?? holder);
      if (!root || root == mounted.root) continue;
      // Svelte removes the root it replaces: one still placed means the
      // component drew a second element.
      if (mounted.root.parentNode) errors.get(mounted)?.(rootError(whats.get(mounted) ?? ""));
      else mounted.replaced(root);
    }
  };
  const rootError = (what: string) =>
    new Error(`A ${words.name} ${what}'s component must ${words.root}`);
  const anchorOf = new WeakMap<Mounted, Node>();
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
        void unmount(instance);
        // Svelte removes a root it placed through a block (`<svelte:element>`,
        // the boundary) from the holder only.
        mounted.root.remove();
        anchor.remove();
      };
      const mounted: Mounted = {
        root: root ?? target.ownerDocument.createElement("span"),
        drawn: state,
        replaced: () => {},
        destroy,
      };
      // Also what a component throwing in its setup leaves: its boundary
      // reports the error a microtask later, to `onerror`.
      if (roots.length != 1 || !root) {
        destroy();
        throw rootError(what);
      }
      anchors.set(anchor, mounted);
      anchorOf.set(mounted, anchor);
      whats.set(mounted, what);
      errors.set(mounted, onerror);
      return mounted;
    },
    take: () => sort(observer.takeRecords()),
    mounted: () => anchors.size > 0,
  };
};
