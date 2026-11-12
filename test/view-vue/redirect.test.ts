// Runs only in the `view-vue` project: fails if the copied tests stop getting VueWordgard editors,
// which would make `view-vue` a second `browser`. Their `Wordgard.DocTile` is then VueWordgard's,
// i.e. VueDocTile.
// Not type-checked, since it imports the copies (.ts imports, upstream style).
import { VueDocTile } from "../../packages/vue/src/VueDocTile.js";
import { VueWordgard } from "../../packages/vue/src/VueWordgard.js";
import { basicBuilders } from "../wordgard/schema.ts";
import { tempEditor } from "../wordgard/tempview.ts";

const { doc, p } = basicBuilders;

describe("view-vue project", () => {
  it("creates the copied tests' editors as VueWordgard", () => {
    const wg = tempEditor(doc(p("x")));
    expect(wg).toBeInstanceOf(VueWordgard);
    expect(wg.docTile).toBeInstanceOf(VueDocTile);
  });
});
