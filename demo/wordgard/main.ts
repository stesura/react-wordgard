// Adapted from Wordgard's demo (demo/demo.ts in its repo), on ReactWordgard and
// with only the schema parts React renders so far. Images and tables come as
// bare schema elements: their extensions add decorations (resizing, cell
// selection), which React doesn't draw yet.
import { menuBar } from "wordgard/editor";
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

import { ReactWordgard } from "../../src/ReactWordgard.js";

declare global {
  interface Window {
    wg?: ReactWordgard;
  }
}

const image =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="24"><rect width="40" height="24" rx="4" fill="#6af"/></svg>'
  );

const parent = document.getElementById("editor");
if (!parent) throw new Error("No #editor element");

window.wg = ReactWordgard.create({
  parent,
  doc: `<h2>Demo content</h2>
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
<figure><img src="${image}"><figcaption>A captioned figure</figcaption></figure>`,
  config: [
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
  ],
});
