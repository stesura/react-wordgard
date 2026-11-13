// Adapted from vue-wordgard's sync.ts (`onPublish`) for Svelte: the document's components commit
// in the renderer's `flushSync`, inside Wordgard's flush; one outside the document (a toolbar)
// would too, its effects running where a dispatch throws. It gets the state once the flush is done.
import { onDestroy } from "svelte";

import type { EditorValue } from "@stesura/wordgard-view";
import { inDocument } from "../contexts/EditorContext.js";

/** What the calling component runs when the editor publishes a state. */
export const onPublish = ({ wg, afterFlush, cancel }: EditorValue, update: () => void) => {
  if (inDocument(wg)) return update;
  onDestroy(() => cancel(update));
  return () => afterFlush(update);
};
