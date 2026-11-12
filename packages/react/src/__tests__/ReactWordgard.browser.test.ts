import { Leaf } from "wordgard/doc";
import { basicSchema } from "wordgard/schema";

import { ReactWordgard } from "../ReactWordgard.js";
import { ReactDocTile } from "../ReactDocTile.js";

describe("ReactWordgard", () => {
  it("keeps its own tile tree through the first render and updates", () => {
    const wg = ReactWordgard.create({
      parent: document.body,
      doc: "<p>hello</p>",
      config: [basicSchema()],
    });

    try {
      expect(wg.docTile).toBeInstanceOf(ReactDocTile);
      expect(wg.contentDOM.wgTile).toBe(wg.docTile);

      wg.dispatch({ changes: { from: 1, insert: [Leaf.text("Hi, ")] } });
      wg.flush();

      expect(wg.docTile).toBeInstanceOf(ReactDocTile);
      expect(wg.contentDOM.wgTile).toBe(wg.docTile);
      expect(wg.contentDOM.textContent).toBe("Hi, hello");
      expect(wg.domAtPos(1).node.textContent).toBe("Hi, hello");
    } finally {
      wg.dom.remove();
    }
  });
});
