// Adapted from react-wordgard's ReactMarkView for Vue: draws a Vue mark's component, its content
// going to its NodeContent. No effects: VueDocTile builds the tiles over what it commits.
import { computed, defineComponent, getCurrentInstance, h, provide, shallowRef } from "vue";
import type { Mark } from "wordgard/doc";

import {
  createDecorationHandlers,
  decorationRoot,
} from "../../../../src/decorations/decorationHandlers.js";
import type { ChildView } from "../../../../src/decorations/iterDeco.js";
import { createShapeHandle, shapeAttributes } from "../../../../src/decorations/shapeType.js";
import type { DecoElt } from "../../../../src/wordgardInternals.js";
import { ContentKey, WrappedKey } from "../../contexts/ContentContext.js";
import { DecorationKey, DecorationRootKey } from "../../contexts/DecorationContext.js";
import { markComponent } from "../../decorations/VueMarkType.js";
import { decorationProps } from "../../helpers/props.js";
import { mergeRefs, rootRef } from "../../helpers/refs.js";

type Props = {
  elt: DecoElt;
  mark: Mark;
  views: readonly ChildView[];
};

export const VueMarkView = defineComponent(
  (props: Props) => {
    const instance = getCurrentInstance();
    if (!instance) throw new Error("No component instance");
    const { handle, ref, contentDOMRef } = createShapeHandle();
    const handlers = createDecorationHandlers(() => {
      const tile = handle.root?.isConnected ? handle.root.wgTile : undefined;
      if (!tile) throw new Error("This Vue mark isn't drawn");
      return tile.posBefore;
    });
    const views = shallowRef<readonly ChildView[] | null>(props.views);
    // A mark is no node: never selected.
    provide(DecorationKey, { handlers, selected: computed(() => false) });
    provide(DecorationRootKey, { tagName: () => props.elt.tagName });
    provide(ContentKey, { views, ref: contentDOMRef });
    provide(WrappedKey, null);
    const root = mergeRefs(ref, decorationRoot(handlers));
    const markProps = computed(() => ({ mark: props.mark, getPos: handlers.getPos }));
    const attach = rootRef(instance, root);
    return () => {
      const { elt } = props;
      views.value = props.views;
      const attrs = decorationProps(shapeAttributes(elt));
      const vnode = h(markComponent(elt), { ...attrs, markProps: markProps.value });
      return attach(vnode, elt.tagName);
    };
  },
  { props: ["elt", "mark", "views"] }
);
