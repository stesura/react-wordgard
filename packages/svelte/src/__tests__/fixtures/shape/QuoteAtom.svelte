<!-- A blockquote drawn as an atom: its content isn't drawn. -->
<script lang="ts">
  import type { ShapeComponentProps } from "../../../decorations/SvelteShapeType.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
  const text = $derived(nodeProps.node.isLeaf ? "" : nodeProps.node.textContent());
</script>

<div {...rest} class="quote">“{text}”</div>
