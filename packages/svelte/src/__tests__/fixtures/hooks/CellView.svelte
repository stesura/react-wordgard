<!-- A cell, th or td: chrome before its content element (pagination's slots), read from the row. -->
<script lang="ts">
  import { getContext } from "svelte";

  import DecorationRoot from "../../../components/DecorationRoot.svelte";
  import type { ShapeComponentProps } from "../../../decorations/SvelteShapeType.js";
  import { RowCells, type RowCellsValue } from "./probes.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
  const cells = getContext<RowCellsValue | undefined>(RowCells) ?? { current: -1 };
</script>

<DecorationRoot {...rest}>
  <div class="slot" aria-hidden="true">{cells.current}</div>
  <div class="cellContent" {@attach contentDOMRef}></div>
</DecorationRoot>
