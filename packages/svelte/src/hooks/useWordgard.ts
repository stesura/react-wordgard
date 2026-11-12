// Adapted from react-wordgard's useWordgard (by way of vue-wordgard's) for Svelte.
import { useEditorContext } from "../contexts/EditorContext.js";

/** The editor, in a component it draws or inside WordgardEditor. */
export const useWordgard = () => useEditorContext("useWordgard").wg;
