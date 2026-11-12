// Not in react-wordgard, where a decoration's component is an element of React's tree: a Svelte
// decoration's component mounted as a root part (helpers/mountRoot.ts), with its decoration's
// context, its errors reported. Shared by ShapeView, WrapperView, SvelteMarkView and WidgetView.
import type { DecorationHandlers } from "@stesura/wordgard-view";
import { type DecorationContextValue, DecorationKey } from "../contexts/DecorationContext.js";
import { box } from "../helpers/box.svelte.js";
import type { AnyComponent } from "../helpers/mountRoot.js";
import { type DrawContext, type RootPart, replaceRoot } from "./ChildNodeViews.js";

export type Decoration = {
  readonly key: string;
  // The view drawing it, which alone updates it.
  readonly view: string;
  // Its kind, for errors: "shape".
  readonly what: string;
  readonly component: AnyComponent;
  readonly props: Record<string, unknown>;
  readonly handlers: DecorationHandlers;
  readonly selected: boolean;
  readonly tagName: string;
  // Hears its root, when mounted and when Svelte replaces it.
  readonly rooted: (root: Element) => void;
  readonly destroy: () => void;
};

export const mountDecoration = (
  { key, view, what, component, props, handlers, selected, tagName, rooted, destroy }: Decoration,
  context: DrawContext
): RootPart => {
  const selectedBox = box(selected);
  const tagNameBox = box(tagName);
  const decoration: DecorationContextValue = {
    handlers,
    selected: selectedBox,
    tagName: tagNameBox,
  };
  const contexts = new Map(context.contexts);
  contexts.set(DecorationKey, decoration);
  const mounted = context.holder.mount({ component, props }, what, contexts, (error) => {
    console.error(error);
    context.failed(error);
  });
  const part: RootPart = {
    kind: "root",
    key,
    view,
    component,
    dom: mounted.root,
    update: (next) => {
      mounted.drawn.current = { component, props: next };
    },
    set: (nextSelected, nextTag) => {
      if (selectedBox.current != nextSelected) selectedBox.current = nextSelected;
      if (tagNameBox.current != nextTag) tagNameBox.current = nextTag;
    },
    destroy: () => {
      destroy();
      mounted.destroy();
    },
  };
  mounted.replaced = (root) => {
    const old = part.dom;
    part.dom = mounted.root = root;
    rooted(root);
    replaceRoot(part, old, root);
  };
  rooted(mounted.root);
  return part;
};
