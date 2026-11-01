// The demo's own node and mark types: a callout (after Stesura's) and a
// mention. A callout's kind and title are marks on it, so changing them is a
// mark change, as for an image's size, not a replacement of the node.
import { Leaf, Mark, Node, Plot, parse } from "wordgard/doc";

export const Callout = Plot.define("Callout", {
  blockContent: Node.Group.Content,
  group: Node.Group.Content,
  defining: true,
  // A cursor can stop between a callout and another barrier (a figure, a
  // callout, the document's sides), as ProseMirror's gap cursor would.
  cursorBarrier: true,
  shape: { element: "aside", selector: "aside.callout", attributes: { class: "callout" } },
});

export const calloutKinds = {
  note: { label: "Note", icon: "ℹ️" },
  tip: { label: "Tip", icon: "💡" },
  warning: { label: "Warning", icon: "⚠️" },
  danger: { label: "Danger", icon: "⛔" },
};

export type CalloutKindName = keyof typeof calloutKinds;

export const isCalloutKind = (kind: unknown): kind is CalloutKindName =>
  typeof kind == "string" && Object.hasOwn(calloutKinds, kind);

export const CalloutKind = Mark.Type.define<CalloutKindName>("CalloutKind", {
  target: Callout,
  validate: (kind) => {
    if (!isCalloutKind(kind)) throw new RangeError(`Unknown callout kind: ${kind}`);
  },
  shape: {
    attribute: "data-kind",
    value: (kind) => kind,
    readAttribute: (kind) => (isCalloutKind(kind) ? kind : parse.Reject),
  },
});

export const CalloutTitle = Mark.Type.define<string>("CalloutTitle", {
  target: Callout,
  validate: "string",
  shape: { attribute: "data-title", value: 0 },
});

export const people: Record<string, { name: string; role: string }> = {
  ada: { name: "Ada Lovelace", role: "Analyst" },
  grace: { name: "Grace Hopper", role: "Compiler writer" },
  alan: { name: "Alan Turing", role: "Codebreaker" },
  margaret: { name: "Margaret Hamilton", role: "Flight software" },
};

// The parameter is a key of `people`.
export const Mention = Leaf.Type.define<string>("Mention", {
  inline: true,
  validate: "string",
  selectable: true,
  toText: (node) => `@${people[String(node.param)]?.name ?? node.param}`,
  shape: {
    element: "span",
    selector: "span[data-mention]",
    attributes: (id) => ({ "data-mention": id }),
    readElement: (elt) => elt.getAttribute("data-mention") ?? parse.Reject,
  },
});
