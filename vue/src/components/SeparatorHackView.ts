// Adapted from react-wordgard's SeparatorHackView for Vue: the `<img class="wg-buffer">`
// (`Widget.img`) at the ends of an inline plot.
import { h } from "vue";

export const SeparatorHackView = (key: string) =>
  h("img", { key, "^class": "wg-buffer", "^alt": "" });
