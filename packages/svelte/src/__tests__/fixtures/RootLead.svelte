<!-- Gives the node it wraps the lead as attributes, which go on its root element. -->
<script lang="ts">
  import WrappedNode from "../../components/WrappedNode.svelte";
  import { useLead } from "./controls.js";

  const lead = useLead();
</script>

<WrappedNode
  class={lead.current == null ? undefined : "led"}
  style={lead.current == null ? undefined : `padding-top: ${lead.current}px`}
  data-lead={lead.current ?? undefined}
/>
