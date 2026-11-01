// Which node views React rendered in its last commit, read from React's fibers
// as React DevTools reads them: only subtrees React worked on are walked (one
// it skipped keeps its children, and their flags, from an older commit), and a
// fiber rendered when it's new or has the PerformedWork flag. React internals,
// the same in React 18 and 19; for tests only.
import { Leaf, type Node, Plot } from "wordgard/doc";

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

// The nodes whose view rendered, outermost first, in the commit of the React
// root holding `dom`.
export const renderedNodes = (dom: Element) => {
  const nodes: Node[] = [];
  const walk = (first: object | null) => {
    for (let fiber = first; fiber; fiber = field(fiber, "sibling")) {
      const alternate = field(fiber, "alternate");
      const rendered = !alternate || (Number(Reflect.get(fiber, "flags")) & PerformedWork) != 0;
      if (rendered && Reflect.get(fiber, "elementType") === DefaultNodeView) {
        const node = Reflect.get(field(field(fiber, "memoizedProps"), "view") ?? {}, "node");
        if (node instanceof Plot || node instanceof Leaf) nodes.push(node);
      }
      if (!alternate || field(fiber, "child") !== field(alternate, "child"))
        walk(field(fiber, "child"));
    }
  };
  walk(rootFiber(dom));
  return nodes;
};
