<!-- A blockquote drawing chrome in its content element: a mistake. -->
<script lang="ts">
  import type { ShapeComponentProps } from "../../../decorations/SvelteShapeType.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
</script>

<blockquote {...rest}><div {@attach contentDOMRef}><i>1</i><i>2</i></div></blockquote>
