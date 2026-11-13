<!-- A quote stopping every mousedown, with structure around its content element. -->
<script lang="ts">
  import DecorationRoot from "../../../components/DecorationRoot.svelte";
  import type { ShapeComponentProps } from "../../../decorations/SvelteShapeType.js";
  import { useStopEvent } from "../../../hooks/useStopEvent.js";
  import { stopMousedown } from "./probes.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
  useStopEvent(stopMousedown);
</script>

<DecorationRoot {...rest} class={["stops", rest["class"]]}>
  <div class="frame"><div class="body" {@attach contentDOMRef}></div></div>
</DecorationRoot>
