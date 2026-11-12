// Not in react-prosemirror: the DOM work React and Vue do for react-wordgard and vue-wordgard, done
// by hand. Svelte templates leave anchors (empty text nodes, comments) in the elements they draw
// into, which Wordgard counts among a content element's children: nothing of the document is a
// Svelte template.
import { Attributes } from "wordgard/doc";

import { localTagName } from "@stesura/wordgard-view";

const SVG = "http://www.w3.org/2000/svg";
const MATHML = "http://www.w3.org/1998/Math/MathML";

// As Wordgard's `Elt.render`: an `svg:` or `math:` tag names the element's namespace.
export const createElement = (doc: Document, tagName: string) =>
  tagName.startsWith("svg:")
    ? doc.createElementNS(SVG, localTagName(tagName))
    : tagName.startsWith("math:")
      ? doc.createElementNS(MATHML, localTagName(tagName))
      : doc.createElement(tagName);

// Sets `next` on an element that had `last`, as attributes (Wordgard's own
// setAttribute), touching only those that changed.
export const setAttributes = (dom: Element, next: Attributes, last: Attributes | null) => {
  if (last == next) return;
  if (last)
    for (let i = 0; i + 1 < last.length; i += 2) {
      const name = last[i];
      if (name !== undefined && Attributes.get(next, name) == null) dom.removeAttribute(name);
    }
  for (let i = 0; i + 1 < next.length; i += 2) {
    const name = next[i];
    const value = next[i + 1];
    if (name === undefined || value === undefined) continue;
    if (!last || Attributes.get(last, name) != value) dom.setAttribute(name, value);
  }
};

// Puts `nodes` in `parent` in this order, moving as few as it can: a node
// moved loses the selection or composition in it. The nodes not in the list
// (widget DOM, the browser's composition) stay where they are: the doc tile
// places them.
export const placeNodes = (parent: Element, nodes: readonly ChildNode[]) => {
  const wanted = new Set(nodes);
  let at = parent.firstChild;
  for (const node of nodes) {
    while (at && at != node && !wanted.has(at)) at = at.nextSibling;
    if (at == node) at = node.nextSibling;
    else parent.insertBefore(node, at);
  }
};
