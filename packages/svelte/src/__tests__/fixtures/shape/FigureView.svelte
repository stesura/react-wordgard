<!-- A block leaf, a figure, its image from the node's parameter. -->
<script lang="ts">
  import type { ShapeComponentProps } from "../../../decorations/SvelteShapeType.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
  const src = $derived(nodeProps.node.isLeaf ? String(nodeProps.node.param) : "");
</script>

<figure {...rest}><img {src} alt="" /></figure>
