// The public API of the Vue view (vue-wordgard), as src/index.ts is react-wordgard's. Hosting in
// the app's tree (WordgardEditor, WordgardDoc) and the rest of the composables are to come.
export { VueWordgard } from "./VueWordgard.js";
export { DecorationRoot } from "./components/DecorationRoot.js";
export { NodeContent } from "./components/NodeContent.js";
export { WrappedNode } from "./components/WrappedNode.js";
export {
  type MarkComponentProps,
  type MarkShapeOptions,
  createMarkShape,
} from "./decorations/VueMarkType.js";
export { type NodeWrapperComponentProps, nodeWrapper } from "./decorations/VueNodeWrapper.js";
export {
  type ShapeComponentProps,
  type VueShape,
  createShape,
} from "./decorations/VueShapeType.js";
export {
  type WidgetComponentProps,
  type WidgetTypeSpec,
  createWidgetType,
} from "./decorations/VueWidgetType.js";
export {
  type WrapperComponentProps,
  type WrapperOptions,
  createWrapper,
} from "./decorations/VueWrapperType.js";
export { useEditorState } from "./hooks/useEditorState.js";
export { useIgnoreMutation } from "./hooks/useIgnoreMutation.js";
export { useIsNodeSelected } from "./hooks/useIsNodeSelected.js";
export { useNodePos } from "./hooks/useNodePos.js";
export { useSelectNode } from "./hooks/useSelectNode.js";
export { useStopEvent } from "./hooks/useStopEvent.js";
export { useWordgard } from "./hooks/useWordgard.js";
