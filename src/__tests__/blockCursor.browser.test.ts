// Typing at a block-level cursor (Wordgard's gap cursor, between two cursor
// barriers) should insert a paragraph there. Chromium and WebKit don't: the
// text goes into the block below, elsewhere, or nowhere, on plain Wordgard as
// on ReactWordgard (docs/wordgard-upstream-bugs.md, 12). Expected to fail
// there, so the run tells us when Wordgard fixes it.
import { Wordgard } from "wordgard/editor";
import { basicSchema, codeBlock, figure } from "wordgard/schema";
import { server, userEvent } from "vitest/browser";

import { ReactWordgard } from "../ReactWordgard.js";

const src = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"/>');

const cases = [
  {
    name: "between two code blocks",
    doc: "<p>before</p><pre>one</pre><pre>two</pre><p>after</p>",
    typed: "before|one|h|two|after",
  },
  {
    name: "between two figures",
    doc: `<p>before</p><figure><img src="${src}"></figure><figure><img src="${src}"></figure><p>after</p>`,
    typed: "before|h|after",
  },
];

const editors = { Wordgard, ReactWordgard };

const fixed = server.browser == "firefox";

describe("typing at a block-level cursor", () => {
  for (const [editor, Editor] of Object.entries(editors)) {
    for (const { name, doc, typed } of cases) {
      (fixed ? it : it.fails)(`inserts a paragraph ${name}, on ${editor}`, async () => {
        const wg = Editor.create({
          parent: document.body,
          doc,
          config: [basicSchema(), codeBlock(), figure()],
        });
        try {
          const [first, second] = wg.state.doc.content;
          const gap = (first?.length ?? 0) + (second?.length ?? 0);
          wg.focus();
          wg.dispatch({ selection: { anchor: gap } });
          expect(wg.state.sel.head.parent.node).toBe(wg.state.doc);

          await userEvent.keyboard("h");
          await new Promise(requestAnimationFrame);

          expect(wg.state.doc.textContent({ blockSeparator: "|" })).toBe(typed);
        } finally {
          wg.dom.remove();
        }
      });
    }
  }
});
