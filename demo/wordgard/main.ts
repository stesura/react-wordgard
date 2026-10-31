// Adapted from Wordgard's demo (demo/demo.ts in its repo), on ReactWordgard and
// with only the schema parts React renders so far.
import { menuBar } from "wordgard/editor";
import { history } from "wordgard/history";
import {
  alignment,
  blockDoc,
  blockquote,
  bulletList,
  codeBlock,
  heading,
  inlineMarks,
  orderedList,
  paragraph,
} from "wordgard/schema";

import { ReactWordgard } from "../../src/ReactWordgard.js";

declare global {
  interface Window {
    wg?: ReactWordgard;
  }
}

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
<pre>some code</pre>`,
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
    history(),
    menuBar(),
  ],
});
