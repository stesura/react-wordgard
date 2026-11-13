<!-- A link whose root is its content element, reporting its position. -->
<script lang="ts">
  import type { MarkComponentProps } from "../../../decorations/SvelteMarkType.js";
  import { useNodePos } from "../../../hooks/useNodePos.js";
  import { seen } from "./probes.js";

  let { markProps, contentDOMRef, ...rest }: MarkComponentProps = $props();
  seen.positions.set("link", useNodePos());
</script>

<a {...rest} href={String(markProps.mark.value)} {@attach contentDOMRef}></a>
