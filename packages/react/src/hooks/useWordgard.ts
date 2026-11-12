// Not in react-prosemirror, which gives the view to callbacks and effects only.
import { useEditorContext } from "../contexts/EditorContext.js";

/** The editor. */
export const useWordgard = () => useEditorContext().wg;
