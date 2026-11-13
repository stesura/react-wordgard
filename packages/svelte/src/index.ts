export { SvelteWordgard } from "./SvelteWordgard.js";
export { default as DecorationRoot } from "./components/DecorationRoot.svelte";
export { default as WordgardDoc } from "./components/WordgardDoc.svelte";
export { default as WordgardEditor } from "./components/WordgardEditor.svelte";
export { default as WrappedNode } from "./components/WrappedNode.svelte";
export {
  type MarkComponentProps,
  type MarkShapeOptions,
  createMarkShape,
} from "./decorations/SvelteMarkType.js";
export { type NodeWrapperComponentProps, nodeWrapper } from "./decorations/SvelteNodeWrapper.js";
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
export { useEditorEffect } from "./hooks/useEditorEffect.svelte.js";
export { useEditorEventListener } from "./hooks/useEditorEventListener.js";
export { useEditorField, useEditorFieldEntry } from "./hooks/useEditorField.svelte.js";
export { type EditorLayoutEffect, useEditorLayoutEffect } from "./hooks/useEditorLayoutEffect.js";
export { useEditorState } from "./hooks/useEditorState.svelte.js";
export { useIgnoreMutation } from "./hooks/useIgnoreMutation.js";
export { useIsNodeSelected } from "./hooks/useIsNodeSelected.js";
export { useNodePos } from "./hooks/useNodePos.js";
export { useSelectNode } from "./hooks/useSelectNode.svelte.js";
export { useStopEvent } from "./hooks/useStopEvent.js";
export { useWordgard } from "./hooks/useWordgard.js";
