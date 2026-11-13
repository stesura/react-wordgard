// Adapted from react-wordgard's DefaultNodeView (by way of vue-wordgard's) for Svelte: a node draws
// as its decorated shape (buildNodeShape), its content in the hole, Svelte shapes, wrappers and
// widgets as their components, inside its node wrappers (NodeWrapperView). It listens to its node's
// cell, so it draws again when the cell gets a new view, not when its list is drawn again, as
// react-wordgard's.
import { Attributes, Elt, type Node } from "wordgard/doc";

import {
  type ChildView,
  type DecoElt,
  type NodeCell,
  type NodeView,
  attributedWidget,
  drawnRoot,
  isComponentShape,
  isComponentWidget,
  isComponentWrapper,
  nodePos,
  shapeAttributes,
  uneditable,
  viewRoot,
} from "@stesura/wordgard-view";
import {
  type DrawContext,
  type DrawnList,
  ElementView,
  type Part,
  destroyPart,
  drawList,
  fill,
  owners,
} from "../ChildNodeViews.js";
import type { AnyComponent } from "../../helpers/mountRoot.js";
import { type NodeProps, NodeWrapperView, type Wrapping } from "../NodeWrapperView.js";
import { ShapeView } from "../ShapeView.js";
import { TextNodeView } from "../TextNodeView.js";
import { WidgetView } from "../WidgetView.js";
import { WrapperView } from "../WrapperView.js";

// A node as drawn: its cell, the view it was drawn from, and its shape's
// parts, `dom` their root. `context` is the one it was drawn in. Its node
// wrappers, and the attributes they gave its root, when it has some.
export type NodePart = {
  readonly kind: "node";
  readonly key: string;
  readonly dom: ChildNode | null;
  cell: NodeCell;
  drawn: NodeView | null;
  tree: Part | null;
  alive: boolean;
  context: DrawContext;
  readonly listener: () => void;
  wrapping: Wrapping | null;
  wrapped: Attributes | null;
  // Its root, for its wrappers' `getPos`.
  readonly root: { root: Element | null };
  nodeProps: NodeProps;
};

// What every part of a node's shape is drawn with.
type NodeDraw = {
  readonly node: Node;
  readonly views: readonly ChildView[] | null;
  readonly selected: boolean;
};

// The shape's own children are keyed apart from the content's.
const shapeKey = (i: number) => `\0${i}`;

const renderShape = (
  draw: NodeDraw,
  shape: DecoElt,
  inEditable: boolean,
  before: Part | undefined,
  key: string,
  context: DrawContext,
  rooted?: (root: Element) => void
): Part => {
  const { node, views, selected } = draw;
  const widget = attributedWidget(shape);
  if (widget) {
    const attrs = shapeAttributes(uneditable(shape, inEditable).shape);
    return WidgetView(before, key, { widget, attrs, selected, rooted }, context);
  }
  const { shape: elt, inEditable: inner } = uneditable(shape, inEditable);
  // Wordgard fills a wrapper's hole with what it wraps, which a Svelte shape
  // would drop.
  if (
    isComponentShape(elt) &&
    (elt.children.length > 1 || elt.children.some((child) => child !== 0))
  )
    throw new Error(`A ${context.words.name} shape can't wrap: use createWrapper`);
  if (isComponentShape(elt))
    return ShapeView(before, key, { elt, node, views, selected, rooted }, context);
  if (isComponentWrapper(elt)) {
    const wrapped = (
      inside: Part | undefined,
      wrappedRooted: (root: Element) => void,
      at: DrawContext
    ) => renderWrapped(draw, elt, inner, inside, wrappedRooted, at);
    return WrapperView(before, key, { elt, node, wrapped, selected, rooted }, context);
  }
  const element = ElementView(before, key, elt.tagName, elt.attrs, context);
  const old = new Map(element.children.map((part) => [part.key, part]));
  const children: Part[] = [];
  let content: DrawnList | null = null;
  elt.children.forEach((child, i) => {
    const at = old.get(shapeKey(i));
    if (child === 0) {
      content = drawList(views ?? [], element.content, context);
      children.push(...content.parts);
    } else if (typeof child == "string") {
      children.push(TextNodeView(at, shapeKey(i), child, context));
    } else if (child instanceof Elt) {
      children.push(renderShape(draw, child, inner, at, shapeKey(i), context));
    } else if (isComponentWidget(child)) {
      children.push(WidgetView(at, shapeKey(i), { widget: child, attrs: [], selected }, context));
    }
  });
  fill(element, children);
  element.content = content;
  rooted?.(element.dom);
  return element;
};

// What a Svelte wrapper wraps: its hole holds one element or widget, whose
// root the wrapper's tiles are built down to.
const renderWrapped = (
  draw: NodeDraw,
  wrapper: DecoElt,
  inEditable: boolean,
  before: Part | undefined,
  rooted: (root: Element) => void,
  context: DrawContext
): Part => {
  const [child, ...rest] = wrapper.children;
  const { name } = context.words;
  if (child === 0) throw new Error(`A ${name} wrapper isn't a shape: use createShape`);
  if (rest.length || child === undefined || typeof child == "string")
    throw new Error(`A ${name} wrapper's hole holds one element or widget`);
  if (child instanceof Elt)
    return renderShape(draw, child, inEditable, before, "", context, rooted);
  if (!isComponentWidget(child))
    throw new Error(
      `A ${name} wrapper can't wrap a native widget: draw ${draw.node.name} with a ${name} widget`
    );
  return WidgetView(
    before,
    "",
    { widget: child, attrs: [], selected: draw.selected, rooted },
    context
  );
};

// Wordgard draws a node selection as a class on the node's shape: on its outer
// element (a widget-drawn node gets one around it), or inside a wrapper a point
// decoration added after it.
const isSelected = (shape: DecoElt): boolean =>
  (Attributes.get(shape.attrs, "class") ?? "").split(" ").includes("wg-selected-node") ||
  shape.children.some((child) => child instanceof Elt && isSelected(child));

const sameComponents = (a: readonly AnyComponent[] | null, b: readonly AnyComponent[] | null) =>
  a == b || (!!a && !!b && a.length == b.length && a.every((component, i) => component == b[i]));

// Its node wrappers' attributes changed: its root gets them.
const rewrapped = (part: NodePart) => () => {
  const attrs = part.wrapping?.attributes();
  if (part.alive && attrs && !Attributes.eq(attrs, part.wrapped ?? Attributes.none))
    draw(part, true);
};

// `force` draws the view drawn already, for its wrappers' attributes.
const draw = (part: NodePart, force = false) => {
  const view = part.cell.view;
  const { context } = part;
  const components = context.wrappers.current?.of(view.node.type) ?? null;
  const rewrap = !sameComponents(components, part.wrapping?.components ?? null);
  if (view == part.drawn && !rewrap && !force) return;
  part.drawn = view;
  const { node, shape, children } = view;
  const old = part.dom;
  const last = rewrap ? part.wrapping : null;
  // Now a native widget: drawn by the doc tile. A node's cell can publish
  // before its list drops it.
  if (!(shape instanceof Elt) && !isComponentWidget(shape)) {
    if (part.tree) destroyPart(part.tree);
    part.tree = null;
    part.wrapping?.destroy();
    part.wrapping = part.wrapped = null;
    old?.parentNode?.removeChild(old);
    return;
  }
  if (part.nodeProps.node != node) {
    part.nodeProps = { node, getPos: part.nodeProps.getPos };
    if (!rewrap) part.wrapping?.update(part.nodeProps);
  }
  // Other wrappers: the node is drawn anew, inside them.
  if (rewrap)
    part.wrapping = components
      ? NodeWrapperView(components, part.nodeProps, context, rewrapped(part))
      : null;
  const { wrapping } = part;
  const inner = wrapping ? { ...context, contexts: wrapping.contexts } : context;
  const wrapped = (part.wrapped = wrapping?.attributes() ?? null);
  const before = rewrap ? undefined : (part.tree ?? undefined);
  // A wrapped node's root takes its wrappers' attributes: ours, as a Svelte
  // shape's root's are (sortRecords drops those records).
  const rooted = (root: Element) => {
    part.root.root = root;
    if (wrapping) drawnRoot(root);
  };
  const tree =
    shape instanceof Elt
      ? renderShape(
          { node, views: node.isPlot ? children : null, selected: isSelected(shape) },
          wrapped
            ? Elt.create(shape.tagName, Attributes.merge(shape.attrs, wrapped), shape.children)
            : shape,
          true,
          before,
          "",
          inner,
          rooted
        )
      : WidgetView(
          before,
          "",
          { widget: shape, attrs: wrapped ?? [], selected: false, rooted },
          inner
        );
  // Drawn on its own (its cell changed), in place of its old root.
  if (old && tree.dom && old != tree.dom) old.parentNode?.replaceChild(tree.dom, old);
  if (part.tree && part.tree != tree) destroyPart(part.tree);
  last?.destroy();
  part.tree = tree;
  owners.set(tree, part);
  if (tree.dom instanceof Element && tree.kind == "element") viewRoot(tree.dom);
};

const listen = (part: NodePart, cell: NodeCell) => {
  if (part.cell == cell && cell.listener == part.listener) return;
  if (part.cell.listener == part.listener) part.cell.listener = null;
  part.cell = cell;
  cell.listener = part.listener;
};

export const destroyNode = (part: NodePart) => {
  part.alive = false;
  part.context.nodes.delete(part);
  if (part.cell.listener == part.listener) part.cell.listener = null;
  if (part.tree) destroyPart(part.tree);
  part.wrapping?.destroy();
};

// Draws the nodes whose cells got a view, after their lists: a node still
// drawn whose list kept its shape draws itself.
export const drawDirty = (dirty: Set<NodePart>) => {
  for (const part of dirty) if (part.alive) draw(part);
  dirty.clear();
};

export const DefaultNodeView = (
  before: Part | undefined,
  key: string,
  cell: NodeCell,
  context: DrawContext
): NodePart => {
  if (before?.kind == "node") {
    listen(before, cell);
    before.context = context;
    draw(before);
    return before;
  }
  const root: { root: Element | null } = { root: null };
  const part: NodePart = {
    kind: "node",
    key,
    get dom() {
      return part.tree?.dom ?? null;
    },
    cell,
    drawn: null,
    tree: null,
    alive: true,
    context,
    listener: () => context.dirty.add(part),
    wrapping: null,
    wrapped: null,
    root,
    nodeProps: { node: cell.view.node, getPos: nodePos(root, context.words.name) },
  };
  cell.listener = part.listener;
  context.nodes.add(part);
  draw(part);
  return part;
};
