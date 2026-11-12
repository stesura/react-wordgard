<!-- A heading drawn by DecorationRoot: its tag is the node's level, and it holds the content. -->
<script lang="ts">
  import DecorationRoot from "../../components/DecorationRoot.svelte";
  import type { ShapeComponentProps } from "../../decorations/SvelteShapeType.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
</script>

<DecorationRoot {...rest} content={contentDOMRef} />
