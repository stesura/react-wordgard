// Adapted from react-wordgard's MarkView (by way of vue-wordgard's) for Svelte: an element-shaped
// mark, or the span of a text run's attribute-shaped marks, its content as its own children, or a
// Svelte mark.
import { type ChildView, viewRoot } from "@stesura/wordgard-view";
import { type DrawContext, ElementView, type Part, drawList, fill } from "../ChildNodeViews.js";
import { SvelteMarkView } from "./SvelteMarkView.js";

type WrapperView = Extract<ChildView, { type: "wrapper" }>;

export const MarkView = (
  before: Part | undefined,
  key: string,
  { elt, mark, children }: WrapperView,
  context: DrawContext
) => {
  if (mark) return SvelteMarkView(before, key, elt, mark, children, context);
  const element = ElementView(before, key, elt.tagName, elt.attrs, context);
  viewRoot(element.dom);
  const content = drawList(children, element.content, context);
  fill(element, content.parts);
  element.content = content;
  return element;
};
