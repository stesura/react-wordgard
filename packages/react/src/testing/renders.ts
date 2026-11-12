// Which node views React rendered in its last commit, read from React's fibers as React DevTools
// does: only the subtrees React worked on. React internals, the same in React 18 and 19.
import { Leaf, type Node, Plot } from "wordgard/doc";

import { ChildNodeViews } from "../components/ChildNodeViews.js";
import { DefaultNodeView } from "../components/nodes/DefaultNodeView.js";

const PerformedWork = 1;

const field = (value: unknown, name: string): object | null => {
  const found = typeof value == "object" && value !== null ? Reflect.get(value, name) : null;
  return typeof found == "object" && found !== null ? found : null;
};

// The root's current tree: its container keeps the root's first fiber.
const rootFiber = (dom: Element) => {
  for (let cur: Element | null = dom; cur; cur = cur.parentElement) {
    const key = Object.keys(cur).find((name) => name.startsWith("__reactContainer$"));
    const current = key ? field(field(Reflect.get(cur, key), "stateNode"), "current") : null;
    if (current) return current;
  }
  throw new Error("No React root around this element");
};

// The fibers rendered in the last commit of the React root holding `dom`.
const renderedFibers = (dom: Element) => {
  const fibers: object[] = [];
  const walk = (first: object | null) => {
    for (let fiber = first; fiber; fiber = field(fiber, "sibling")) {
      const alternate = field(fiber, "alternate");
      if (!alternate || (Number(Reflect.get(fiber, "flags")) & PerformedWork) != 0)
        fibers.push(fiber);
      if (!alternate || field(fiber, "child") !== field(alternate, "child"))
        walk(field(fiber, "child"));
    }
  };
  walk(rootFiber(dom));
  return fibers;
};

// The nodes whose view rendered, outermost first.
export const renderedNodes = (dom: Element) => {
  const nodes: Node[] = [];
  for (const fiber of renderedFibers(dom)) {
    if (Reflect.get(fiber, "elementType") !== DefaultNodeView) continue;
    const cell = field(field(fiber, "memoizedProps"), "cell");
    const node = Reflect.get(field(cell, "view") ?? {}, "node");
    if (node instanceof Plot || node instanceof Leaf) nodes.push(node);
  }
  return nodes;
};

// How many lists of node views rendered (ChildNodeViews, the function its memo
// wraps).
export const renderedLists = (dom: Element) => {
  const list = Reflect.get(ChildNodeViews, "type");
  return renderedFibers(dom).filter((fiber) => Reflect.get(fiber, "elementType") === list).length;
};
