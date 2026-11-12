// How the core's errors name Svelte, and their advice (the core's words.ts).
import type { Words } from "@stesura/wordgard-view";

const root = "draw one element at its root (DecorationRoot or an element)";

export const svelteWords: Words = {
  library: "svelte-wordgard",
  name: "Svelte",
  root,
  widgetRoot: root,
  content: "contentDOMRef",
  wrapped: "an element with wrappedDOMRef",
  anchor: "draw the content element empty, with contentDOMRef, and chrome beside it",
};
