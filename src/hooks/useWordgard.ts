// The editor a component is drawn in: what a widget's `render` gets.
import { useRenderStore } from "../contexts/RenderStoreContext.js";

export const useWordgard = () => useRenderStore().wg;
