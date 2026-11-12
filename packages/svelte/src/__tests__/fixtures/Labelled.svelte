<!-- A shape drawing chrome in its root, which holds the content: a mistake. -->
<script lang="ts">
  import type { ShapeComponentProps } from "../../decorations/SvelteShapeType.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
</script>

<div {...rest}><span class="label">L</span></div>
