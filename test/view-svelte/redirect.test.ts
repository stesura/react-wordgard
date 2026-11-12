// Runs only in the `view-svelte` project: fails if the copied tests stop getting SvelteWordgard editors,
// which would make `view-svelte` a second `browser`. Their `Wordgard.DocTile` is then SvelteWordgard's,
// i.e. SvelteDocTile.
// Not type-checked, since it imports the copies (.ts imports, upstream style).
import { SvelteDocTile } from "../../packages/svelte/src/SvelteDocTile.js";
import { SvelteWordgard } from "../../packages/svelte/src/SvelteWordgard.js";
import { basicBuilders } from "../wordgard/schema.ts";
import { tempEditor } from "../wordgard/tempview.ts";

const { doc, p } = basicBuilders;

describe("view-svelte project", () => {
  it("creates the copied tests' editors as SvelteWordgard", () => {
    const wg = tempEditor(doc(p("x")));
    expect(wg).toBeInstanceOf(SvelteWordgard);
    expect(wg.docTile).toBeInstanceOf(SvelteDocTile);
  });
});
