// Not in react-wordgard, whose DefaultNodeView nests a node's wrappers as elements, each given the
// next as `children`. Here each wrapper is drawn by one of these, which hands the next (or the
// node's drawing) to the wrapper's WrappedNode. It renders no element.
import { type Component, type VNode, defineComponent, h, provide, shallowRef } from "vue";
import type { Node } from "wordgard/doc";

import { ContentKey, WrappedKey } from "../contexts/ContentContext.js";
import { DecorationKey, DecorationRootKey } from "../contexts/DecorationContext.js";

type Props = {
  components: readonly Component[];
  index: number;
  nodeProps: { node: Node; getPos: () => number };
  // The node's drawing.
  draw: () => VNode;
};

export const NodeWrapperView = defineComponent(
  (props: Props) => {
    const draw = shallowRef(props.draw);
    provide(WrappedKey, { draw });
    // A node wrapper isn't a decoration.
    provide(DecorationKey, null);
    provide(DecorationRootKey, null);
    provide(ContentKey, null);
    return () => {
      const { components, index, nodeProps } = props;
      draw.value =
        index + 1 < components.length
          ? () => h(NodeWrapperView, { components, index: index + 1, nodeProps, draw: props.draw })
          : props.draw;
      const component = components[index];
      if (!component) throw new Error("No node wrapper to draw");
      return h(component, { nodeProps });
    };
  },
  { props: ["components", "index", "nodeProps", "draw"] }
);
