<!-- A heading whose root holds the content, drawn by DecorationRoot without contentDOMRef. -->
<script lang="ts">
  import DecorationRoot from "../../components/DecorationRoot.svelte";
  import type { ShapeComponentProps } from "../../decorations/SvelteShapeType.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
</script>

<DecorationRoot {...rest} />
