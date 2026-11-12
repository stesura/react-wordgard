// Adapted from react-wordgard's ReactWordgard.ts for Vue: the editor Vue draws (VueDocTile).
// What isn't Vue's is in the core's RenderedWordgard.ts.
import type { Wordgard } from "wordgard/editor";

import { RenderedWordgard } from "@stesura/wordgard-view";
import { VueDocTile } from "./VueDocTile.js";

export class VueWordgard extends RenderedWordgard {
  // An editor drawn by Vue on its own, outside the app's components.
  static create = (spec: Wordgard.Spec) => new VueWordgard(spec, false);

  // An editor WordgardEditor hosts: WordgardDoc draws its document.
  static host = (spec: Wordgard.Spec) => new VueWordgard(spec, true);

  // Wordgard's own tests build tile trees through `Wordgard.DocTile`.
  static DocTile = VueDocTile;

  constructor(spec: Wordgard.Spec, hosted = false) {
    super(spec, VueDocTile, hosted);
  }
}
