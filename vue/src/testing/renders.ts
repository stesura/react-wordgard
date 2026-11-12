// Adapted from react-wordgard's testing/renders.ts for Vue: which node views rendered in an update,
// and how many lists of node views. Vue keeps no record of what it rendered, so these compare the
// document's vnodes after the update with those before, walked from the content element's
// (`_vnode`, Vue's internal record of what `render()` drew there).
import { type ComponentInternalInstance, type VNode, isVNode } from "vue";
import { Leaf, type Node, Plot } from "wordgard/doc";

import { TileFlag } from "../../../src/wordgardInternals.js";
import { DefaultNodeView } from "../components/nodes/DefaultNodeView.js";

const field = (value: unknown, name: string): unknown =>
  typeof value == "object" && value !== null ? Reflect.get(value, name) : undefined;

// The document's vnodes, its node views' components, and its lists: the
// children of the content element and of each plot's content element.
const walk = (dom: Element) => {
  const vnodes = new Set<VNode>();
  const views: ComponentInternalInstance[] = [];
  const lists: VNode[][] = [];
  const visit = (vnode: unknown) => {
    if (!isVNode(vnode)) return;
    vnodes.add(vnode);
    const { component, children, el } = vnode;
    if (component) {
      if (vnode.type === DefaultNodeView) views.push(component);
      visit(component.subTree);
      return;
    }
    if (!Array.isArray(children)) return;
    const flags = el instanceof Element ? (el.wgTile?.flags ?? 0) : 0;
    if (el == dom || flags & TileFlag.PlotContent) lists.push(children.filter(isVNode));
    for (const child of children) visit(child);
  };
  visit(Reflect.get(dom, "_vnode"));
  return { vnodes, views, lists };
};

/**
 * Call before an update; the function returned tells, after it, which nodes' views rendered
 * (outermost first, once however many times) and how many lists Vue drew anew (a list beside fresh
 * chrome counts too).
 */
export const watchRenders = (dom: Element) => {
  const before = walk(dom).vnodes;
  return () => {
    const after = walk(dom);
    const nodes: Node[] = [];
    for (const view of after.views) {
      if (before.has(view.subTree)) continue;
      const node = field(field(field(view.props, "cell"), "view"), "node");
      if (node instanceof Plot || node instanceof Leaf) nodes.push(node);
    }
    const lists = after.lists.filter((list) => list.some((vnode) => !before.has(vnode))).length;
    return { nodes, lists };
  };
};
