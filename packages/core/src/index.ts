// What react-wordgard and vue-wordgard take from the core. Not an API for apps: it changes with
// the views, released with them at the same version.
export { type EditorEvent, listenersOf } from "./contexts/editorEvents.js";
export {
  createDecorationHandlers,
  type DecorationHandlers,
  decorationRoot,
} from "./decorations/decorationHandlers.js";
export {
  type ChildView,
  type NodeView,
  shapeOf,
  uneditable,
  VOID,
  type WrapperView,
} from "./decorations/iterDeco.js";
export { defineMarkShape, isComponentMark, type MarkShape } from "./decorations/markType.js";
export {
  createNodeWrappers,
  defineNodeWrappers,
  type NodeWrappers,
  type SelectTypes,
} from "./decorations/nodeWrapperType.js";
export {
  atomRef,
  type ComponentShape,
  createShapeHandle,
  createWrapperHandle,
  defineShape,
  idOf,
  isComponentShape,
  nodePos,
  shapeAttributes,
} from "./decorations/shapeType.js";
export {
  attributedWidget,
  defineWidgetType,
  isComponentWidget,
  widgetRoot,
} from "./decorations/widgetType.js";
export { defineWrapper, isComponentWrapper } from "./decorations/wrapperType.js";
export { type EditorValue, editorOf, findEditor, type StateField } from "./editorStore.js";
export { attrsToRecord, localTagName, namespaced } from "./helpers/elt.js";
export { childViewKeys } from "./reactKeys.js";
export { type NodeCell, cellOf } from "./renderStore.js";
export { RenderedWordgard } from "./RenderedWordgard.js";
export {
  createDocTile,
  type HostedRenderer,
  hostDocTile,
  nodeViewOf,
  RefusedUpdate,
  RenderedDocTile,
  type Renderer,
  type RendererContext,
} from "./tile.js";
export { viewRoot, drawnRoot } from "./viewRoots.js";
export { type DecoElt, DocTile, type Tile, TileFlag } from "./wordgardInternals.js";
export type { Words } from "./words.js";
