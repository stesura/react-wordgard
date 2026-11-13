<!-- A row, its root holding its cells, handing them how many they are. -->
<script lang="ts">
  import { setContext } from "svelte";

  import DecorationRoot from "../../../components/DecorationRoot.svelte";
  import type { ShapeComponentProps } from "../../../decorations/SvelteShapeType.js";
  import { RowCells, type RowCellsValue, isPlot } from "./probes.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
  const cells = $derived(isPlot(nodeProps.node) ? nodeProps.node.content.length : -1);
  const value: RowCellsValue = {
    get current() {
      return cells;
    },
  };
  setContext(RowCells, value);
</script>

<DecorationRoot {...rest} content={contentDOMRef} />
