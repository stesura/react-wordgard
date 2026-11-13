<!-- A table: a colgroup from the first row's widths (an {#each}) before its tbody. -->
<script lang="ts">
  import DecorationRoot from "../../../components/DecorationRoot.svelte";
  import type { ShapeComponentProps } from "../../../decorations/SvelteShapeType.js";
  import { columnsOf } from "./probes.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
  const widths = $derived(columnsOf(nodeProps.node));
</script>

<DecorationRoot {...rest}>
  <colgroup>
    {#each widths as width, i (i)}<col style:width="{width}px" />{/each}
  </colgroup>
  <tbody {@attach contentDOMRef}></tbody>
</DecorationRoot>
