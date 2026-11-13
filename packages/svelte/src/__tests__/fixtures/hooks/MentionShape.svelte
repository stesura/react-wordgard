<!-- An inline atom whose chrome is its text, stopping every mousedown. -->
<script lang="ts">
  import DecorationRoot from "../../../components/DecorationRoot.svelte";
  import type { ShapeComponentProps } from "../../../decorations/SvelteShapeType.js";
  import { useStopEvent } from "../../../hooks/useStopEvent.js";
  import { stopMousedown } from "./probes.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
  useStopEvent(stopMousedown);
  const name = $derived(nodeProps.node.isLeaf ? String(nodeProps.node.param) : "");
</script>

<DecorationRoot {...rest}>@{name}</DecorationRoot>
