// Runs only in the `view` project: fails if the copied tests stop getting
// ReactWordgard editors, which would make `view` a second `browser`. Their
// `Wordgard.DocTile` is then ReactWordgard's, i.e. ReactDocTile.
// Not type-checked, since it imports the copies (.ts imports, upstream style).
import { ReactWordgard } from "../../packages/react/src/ReactWordgard.js";
import { ReactDocTile } from "../../packages/react/src/ReactDocTile.js";
import { basicBuilders } from "../wordgard/schema.ts";
import { tempEditor } from "../wordgard/tempview.ts";

const { doc, p } = basicBuilders;

describe("view project", () => {
  it("creates the copied tests' editors as ReactWordgard", () => {
    const wg = tempEditor(doc(p("x")));
    expect(wg).toBeInstanceOf(ReactWordgard);
    expect(wg.docTile).toBeInstanceOf(ReactDocTile);
  });
});
