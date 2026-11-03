// Wordgard's createChangeSet is quadratic when a transaction's changes go back
// in the document: each change before the previous one starts a change set of
// its own, composed into all the others. `npm run demo`, then open
// /bench/changeOrder/.
import { Leaf } from "wordgard/doc";
import { Wordgard } from "wordgard/editor";
import { history } from "wordgard/history";
import { basicSchema } from "wordgard/schema";

const sizes = [1000, 2000, 4000, 8000];

const parent = document.getElementById("editor-parent");
const output = document.getElementById("output");
if (!parent || !output) throw new Error("Missing #editor-parent or #output");

const run = (paragraphs: number, order: "descending" | "ascending") => {
  const wg = Wordgard.create({
    parent,
    doc: "<p>Lorem ipsum dolor sit amet.</p>".repeat(paragraphs),
    config: [basicSchema(), history()],
  });
  wg.flush();
  const starts: number[] = [];
  let pos = 0;
  for (const node of wg.state.doc.content) {
    starts.push(pos + 1);
    pos += node.length;
  }
  if (order == "descending") starts.reverse();
  const start = performance.now();
  const tr = wg.state.update({
    changes: starts.map((from) => ({ from, insert: [Leaf.text("x")] })),
  });
  const built = performance.now();
  wg.dispatch(tr);
  wg.flush();
  const drawn = performance.now();
  const doc = wg.state.doc;
  wg.dom.remove();
  return { build: built - start, dispatch: drawn - built, doc };
};

const row = (cells: (string | number)[]) => {
  const tr = document.createElement("tr");
  for (const cell of cells) {
    const td = document.createElement("td");
    td.textContent = String(cell);
    tr.appendChild(td);
  }
  output.appendChild(tr);
};

// A first run compiles the code.
run(100, "descending");
run(100, "ascending");
for (const paragraphs of sizes) {
  const descending = run(paragraphs, "descending");
  const ascending = run(paragraphs, "ascending");
  if (!descending.doc.eq(ascending.doc)) throw new Error("The two orders gave different documents");
  row([paragraphs, "descending", descending.build.toFixed(1), descending.dispatch.toFixed(1)]);
  row([paragraphs, "ascending", ascending.build.toFixed(1), ascending.dispatch.toFixed(1)]);
}
