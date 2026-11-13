<!-- A paragraph with a style of its own, beside Wordgard's. -->
<script lang="ts">
  import type { ShapeComponentProps } from "../../../decorations/SvelteShapeType.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
</script>

<p {...rest} style:color="red"></p>
