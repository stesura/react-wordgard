<script lang="ts">
  import type { ShapeComponentProps } from "../../../decorations/SvelteShapeType.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
</script>

<blockquote {...rest} data-note>
  <span class="label" aria-hidden="true">Note</span>
  <div {@attach contentDOMRef}></div>
</blockquote>
