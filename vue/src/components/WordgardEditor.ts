// Adapted from react-wordgard's WordgardEditor for Vue. The spec is read once: Wordgard's editor
// owns its state.
import { defineComponent, provide } from "vue";
import type { Wordgard } from "wordgard/editor";

import { editorOf } from "../../../src/editorStore.js";
import { VueWordgard } from "../VueWordgard.js";
import { EditorKey } from "../contexts/EditorContext.js";

/**
 * Creates a Wordgard editor from the spec (`doc`, `config`, `selection`, `state`, `scrollTo`) and
 * provides it to the components in its slot. It draws no element of its own. The spec is read
 * once, in setup: from then on the editor owns its state.
 */
export const WordgardEditor = defineComponent(
  (props: Omit<Wordgard.Spec, "parent">, { slots }) => {
    const { doc, config, selection, state, scrollTo } = props;
    provide(EditorKey, editorOf(VueWordgard.host({ doc, config, selection, state, scrollTo })));
    return () => slots.default?.();
  },
  { props: ["doc", "config", "selection", "state", "scrollTo"] }
);
