export { SvelteWordgard } from "./SvelteWordgard.js";
export { default as DecorationRoot } from "./components/DecorationRoot.svelte";
export {
  type MarkComponentProps,
  type MarkShapeOptions,
  createMarkShape,
} from "./decorations/SvelteMarkType.js";
export {
  type ShapeComponentProps,
  type SvelteShape,
  createShape,
} from "./decorations/SvelteShapeType.js";
export {
  type WidgetComponentProps,
  type WidgetTypeSpec,
  createWidgetType,
} from "./decorations/SvelteWidgetType.js";
export {
  type WrapperComponentProps,
  type WrapperOptions,
  createWrapper,
} from "./decorations/SvelteWrapperType.js";
export { useIgnoreMutation } from "./hooks/useIgnoreMutation.js";
export { useIsNodeSelected } from "./hooks/useIsNodeSelected.js";
export { useNodePos } from "./hooks/useNodePos.js";
export { useSelectNode } from "./hooks/useSelectNode.svelte.js";
export { useStopEvent } from "./hooks/useStopEvent.js";
export { useWordgard } from "./hooks/useWordgard.js";
