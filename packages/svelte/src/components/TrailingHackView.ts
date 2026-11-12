// Adapted from react-wordgard's TrailingHackView (by way of vue-wordgard's) for Svelte: the `<br>`
// a textblock may need (`Widget.br`).
import { type DrawContext, ElementView, type Part } from "./ChildNodeViews.js";

export const TrailingHackView = (before: Part | undefined, key: string, context: DrawContext) =>
  ElementView(before, key, "br", [], context);
