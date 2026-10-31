// The editor a component is drawn in, or under (WordgardEditor): what a
// widget's `render` gets.
import { useEditorContext } from "../contexts/EditorContext.js";

export const useWordgard = () => useEditorContext().wg;
