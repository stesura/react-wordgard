// Adapted from Wordgard's demo (demo/demo.ts in its repo), on react-wordgard's
// components, with only the schema parts React renders so far. Images and
// tables come as bare schema elements, without their extensions' decorations
// (resizing, cell selection). Images are drawn by a React widget.
import React, { StrictMode, forwardRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Decoration, type Wordgard, menuBar } from "wordgard/editor";
import { history } from "wordgard/history";
import {
  alignment,
  blockDoc,
  blockquote,
  bulletList,
  codeBlock,
  heading,
  horizontalRule,
  inlineMarks,
  lineBreak,
  orderedList,
  paragraph,
} from "wordgard/schema";
import { GardState } from "wordgard/state";
import { CaptionedFigure, Cell, HeaderCell, Image, Table, TableRow } from "wordgard/types";

import {
  WordgardDoc,
  WordgardEditor,
  reactWidget,
  useEditorEffect,
  useEditorStateSelector,
} from "../src/index.js";

declare global {
  interface Window {
    wg?: Wordgard;
  }
}

const image =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="24"><rect width="40" height="24" rx="4" fill="#6af"/></svg>'
  );

// An image drawn by React, with state of its own: hovering outlines it.
const ImageView = forwardRef<HTMLImageElement, { value: string }>(({ value }, ref) => {
  const [hover, setHover] = useState(false);
  return (
    <img
      ref={ref}
      src={value}
      style={hover ? { outline: "2px solid #6af" } : undefined}
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
    />
  );
});
const ReactImage = reactWidget({
  render: (src) => Object.assign(document.createElement("img"), { src }),
  component: ImageView,
});

const WordCount = () => {
  const words = useEditorStateSelector(
    (state) => state.doc.textContent().split(/\s+/).filter(Boolean).length
  );
  return <p>{words} words</p>;
};

// The editor, for the console.
const Expose = () => {
  useEditorEffect((wg) => {
    window.wg = wg;
  }, []);
  return null;
};

const doc = `<h2>Demo content</h2>
<p>A <em>paragraph</em> with <strong>strong <em>and emphasized</em></strong> text,
<a href="https://wordgard.net">a link</a>, <code>code</code>,
<span style="color: crimson">colored <span style="background-color: khaki">and highlighted</span></span> text.</p>
<p style="text-align: center">A centered paragraph.</p>
<blockquote><p>A quote.</p></blockquote>
<ul><li><p>A bullet</p></li><li><p>Another</p></li></ul>
<ol><li><p>A numbered item</p></li></ol>
<pre>some code</pre>
<p>A line<br>break, and an image: <img src="${image}"></p>
<hr>
<table><tbody><tr><th>Head</th><th>Other</th></tr><tr><td>A <em>cell</em></td><td>Another</td></tr></tbody></table>
<figure><img src="${image}"><figcaption>A captioned figure</figcaption></figure>`;

const config = [
  blockDoc(),
  paragraph(),
  heading(),
  blockquote(),
  bulletList(),
  orderedList(),
  codeBlock(),
  inlineMarks(),
  alignment(),
  lineBreak(),
  horizontalRule(),
  GardState.schemaElement.of([Image, CaptionedFigure, Table, TableRow, Cell, HeaderCell]),
  history(),
  menuBar(),
  Decoration.Tag.shape(Image, (tag) => ReactImage.of(tag.param)),
];

const root = document.getElementById("editor");
if (!root) throw new Error("No #editor element");

createRoot(root).render(
  <StrictMode>
    <WordgardEditor doc={doc} config={config}>
      <Expose />
      <WordCount />
      <WordgardDoc />
    </WordgardEditor>
  </StrictMode>
);
