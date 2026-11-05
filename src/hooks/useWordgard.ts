import { useEditorContext } from "../contexts/EditorContext.js";

/** The editor. */
export const useWordgard = () => useEditorContext().wg;
