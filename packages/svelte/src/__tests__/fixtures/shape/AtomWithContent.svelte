<!-- An atom drawing a content element: a mistake. -->
<script lang="ts">
  import type { ShapeComponentProps } from "../../../decorations/SvelteShapeType.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
</script>

<span {...rest}><span {@attach contentDOMRef}></span></span>
