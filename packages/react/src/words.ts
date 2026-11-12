// How the core's errors name React, and their advice (the core's words.ts).
import type { Words } from "@stesura/wordgard-view";

export const reactWords: Words = {
  library: "react-wordgard",
  name: "React",
  root: "draw a DecorationRoot, or forward its ref to its root element",
  widgetRoot: "forward its ref to its root element",
  content: "contentDOMRef",
  wrapped: "its children",
  // React draws neither.
  anchor: "draw elements there",
};
