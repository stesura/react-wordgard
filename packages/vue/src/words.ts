// How the core's errors name Vue, and their advice (the core's words.ts).
import type { Words } from "@stesura/wordgard-view";

const root = "draw one element at its root (DecorationRoot, NodeContent or an element)";

export const vueWords: Words = {
  library: "vue-wordgard",
  name: "Vue",
  root,
  widgetRoot: root,
  content: "NodeContent",
  wrapped: "a WrappedNode",
  anchor:
    "draw that root with DecorationRoot, or the chrome in NodeContent's slots, which drop v-if's and v-for's, and give components there one root",
};
