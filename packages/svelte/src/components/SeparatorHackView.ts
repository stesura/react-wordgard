// Adapted from react-wordgard's SeparatorHackView (by way of vue-wordgard's) for Svelte: the
// `<img class="wg-buffer">` (`Widget.img`) at the ends of an inline plot.
import { type DrawContext, ElementView, type Part } from "./ChildNodeViews.js";

// In the order Wordgard sets them, which tests read in `innerHTML`.
const attrs = ["class", "wg-buffer", "alt", ""];

export const SeparatorHackView = (before: Part | undefined, key: string, context: DrawContext) =>
  ElementView(before, key, "img", attrs, context);
