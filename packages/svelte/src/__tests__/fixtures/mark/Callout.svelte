<!-- A callout as the README advises: its decorative icon hidden, its control labelled. -->
<script lang="ts">
  import DecorationRoot from "../../../components/DecorationRoot.svelte";
  import type { ShapeComponentProps } from "../../../decorations/SvelteShapeType.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
</script>

<DecorationRoot {...rest}>
  <span aria-hidden="true">!</span>
  <button type="button" aria-label="Collapse">-</button>
  <div {@attach contentDOMRef}></div>
</DecorationRoot>
