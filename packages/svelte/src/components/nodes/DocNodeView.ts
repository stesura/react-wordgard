// Adapted from react-wordgard's DocNodeView (by way of vue-wordgard's) for Svelte: Wordgard's
// content element itself, its children the document's content. Its own attributes are Wordgard's.
import type { ChildView } from "@stesura/wordgard-view";
import { type DrawContext, type DrawnList, drawList, placeParts } from "../ChildNodeViews.js";

export const DocNodeView = (
  dom: Element,
  views: readonly ChildView[],
  last: DrawnList | null,
  context: DrawContext
): DrawnList => {
  const next = drawList(views, last, context);
  placeParts(dom, next.parts, last?.parts ?? []);
  return next;
};
