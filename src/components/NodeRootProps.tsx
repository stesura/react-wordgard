// Not in react-prosemirror. Stesura's fork drew a node a host schema defined with
// `DerivedSpecView`, which read its extensions' slots: a node wrapper could give such a node its
// attributes. Here a node Wordgard draws (its type's shape, no React shape) gets them from its
// wrappers through this context.
import {
  type CSSProperties,
  type ReactNode,
  createContext,
  createElement,
  useContext,
  useMemo,
} from "react";
import type { Node } from "wordgard/doc";

import { useStyleObject } from "../helpers/attributes.js";
import { cssToStyle, eltProps, reactTagName } from "../helpers/props.js";

/** What node wrappers give the element of a node Wordgard draws. */
export type NodeRootPropsValue = {
  /** Joined with the node's own. */
  readonly className?: string;
  /** Merged over the node's own, its keys winning. */
  readonly style?: CSSProperties;
  /** HTML attributes, over the node's own; an undefined one is left out. */
  readonly attributes?: Readonly<Record<string, string | number | undefined>>;
};

type Scoped = { readonly node: Node; readonly props: NodeRootPropsValue };

const NodeRootPropsContext = createContext<Scoped | null>(null);

const merge = (outer: NodeRootPropsValue, inner: NodeRootPropsValue): NodeRootPropsValue => ({
  className: [outer.className, inner.className].filter(Boolean).join(" ") || undefined,
  style: outer.style || inner.style ? { ...outer.style, ...inner.style } : undefined,
  attributes:
    outer.attributes || inner.attributes ? { ...outer.attributes, ...inner.attributes } : undefined,
});

/**
 * In a node wrapper's component, around its `children`: props for the element of the node it
 * wraps, when Wordgard draws that node (its type's shape): the outermost element of its decorated
 * shape, a `Decoration.Tag.wrapper`'s when one wraps it. Around a React wrapper (`createWrapper`)
 * they go nowhere. A React shape draws its own root and
 * doesn't read them: hand it data through a context of your own. Several wrappers on one node
 * merge theirs, the inner ones' winning. Keep it mounted, with no props when there's nothing to
 * give: rendering it conditionally remounts the node.
 */
export const NodeRootProps = ({
  node,
  children,
  ...props
}: NodeRootPropsValue & { readonly node: Node; readonly children?: ReactNode }) => {
  const outer = useContext(NodeRootPropsContext);
  const { className, style, attributes } = props;
  // Only this node's: a node in its content has wrappers of its own, or none.
  const own = outer?.node == node ? outer.props : null;
  const value = useMemo(
    () => ({
      node,
      props: own ? merge(own, { className, style, attributes }) : { className, style, attributes },
    }),
    [node, own, className, style, attributes]
  );
  return createElement(NodeRootPropsContext.Provider, { value }, children);
};

// Elements drawn with their wrappers' props: their attributes are React's, as a React shape's
// root's are (sortRecords drops those records).
const drawnRoots = new WeakSet<Element>();

export const isDrawnRoot = (dom: EventTarget) => dom instanceof Element && drawnRoots.has(dom);

const rootRef = (ref: ((dom: Element | null) => void) | undefined) => (dom: Element | null) => {
  if (dom) drawnRoots.add(dom);
  ref?.(dom);
};

const attributeRecord = (attributes: NonNullable<NodeRootPropsValue["attributes"]>) => {
  const record: Record<string, string> = {};
  for (const [name, value] of Object.entries(attributes))
    if (value !== undefined) record[name] = String(value);
  return record;
};

type DrawnRootProps = {
  readonly node: Node;
  readonly tagName: string;
  /** The element's attributes, as Wordgard's shape gives them. */
  readonly attrs: Record<string, string>;
  readonly elementRef?: (dom: Element | null) => void;
  readonly children: ReactNode[];
};

/** The element of a node Wordgard draws, with what its wrappers give it (`NodeRootProps`). */
export const DrawnRoot = ({ node, tagName, attrs, elementRef, children }: DrawnRootProps) => {
  const scoped = useContext(NodeRootPropsContext);
  const given = scoped?.node == node ? scoped.props : null;
  const ref = useMemo(() => rootRef(elementRef), [elementRef]);
  // Wordgard's style is a string, which React can't merge with an object.
  const styled = useStyleObject(!!given?.style);
  const { style: css, ...rest } = attrs;
  const own = eltProps(tagName, styled ? rest : attrs);
  const extra = given?.attributes ? eltProps(tagName, attributeRecord(given.attributes)) : {};
  const className = [own.className, given?.className].filter(Boolean).join(" ") || undefined;
  return createElement(
    reactTagName(tagName),
    {
      ...own,
      ...extra,
      className,
      ...(styled && { style: { ...cssToStyle(css), ...given?.style } }),
      ref,
      suppressContentEditableWarning: true,
    },
    ...children
  );
};
