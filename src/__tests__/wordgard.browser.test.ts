import { Leaf } from "wordgard/doc";
import { Wordgard } from "wordgard/editor";
import { basicSchema } from "wordgard/schema";

describe("wordgard in a browser", () => {
  it("renders a document and flushes an edit to the DOM", () => {
    const wg = Wordgard.create({
      parent: document.body,
      doc: "<p>hello</p>",
      config: [basicSchema()],
    });

    try {
      expect(wg.contentDOM.textContent).toBe("hello");

      wg.dispatch({ changes: { from: 1, insert: [Leaf.text("Hi, ")] } });
      wg.flush();

      expect(wg.contentDOM.textContent).toBe("Hi, hello");
    } finally {
      wg.dom.remove();
    }
  });
});
