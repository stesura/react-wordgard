<!-- A blockquote's shape, its lead from the wrappers around it as a data attribute. -->
<script lang="ts">
  import DecorationRoot from "../../components/DecorationRoot.svelte";
  import type { ShapeComponentProps } from "../../decorations/SvelteShapeType.js";
  import { useLead } from "./controls.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
  const lead = useLead();
</script>

<DecorationRoot {...rest} content={contentDOMRef} data-lead={lead.current ?? undefined} />
