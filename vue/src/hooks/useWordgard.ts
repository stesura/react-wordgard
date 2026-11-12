// Adapted from react-wordgard's useWordgard for Vue.
import { useEditorContext } from "../contexts/EditorContext.js";

/** The editor the component is drawn in. */
export const useWordgard = () => useEditorContext("useWordgard").wg;
