// Adapted from react-wordgard's ReactWordgard.ts (by way of vue-wordgard's VueWordgard.ts) for
// Svelte: the editor our renderer draws (SvelteDocTile). What isn't Svelte's is in the core's
// RenderedWordgard.ts.
import type { Wordgard } from "wordgard/editor";

import { RenderedWordgard } from "@stesura/wordgard-view";
import { SvelteDocTile } from "./SvelteDocTile.js";

export class SvelteWordgard extends RenderedWordgard {
  // An editor drawn on its own, outside the app's components.
  static create = (spec: Wordgard.Spec) => new SvelteWordgard(spec);

  // Wordgard's own tests build tile trees through `Wordgard.DocTile`.
  static DocTile = SvelteDocTile;

  constructor(spec: Wordgard.Spec) {
    super(spec, SvelteDocTile, false);
  }
}
