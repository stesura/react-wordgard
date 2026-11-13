<!-- A link drawn by DecorationRoot, its content in a span. -->
<script lang="ts">
  import DecorationRoot from "../../../components/DecorationRoot.svelte";
  import type { MarkComponentProps } from "../../../decorations/SvelteMarkType.js";

  let { markProps, contentDOMRef, ...rest }: MarkComponentProps = $props();
</script>

<DecorationRoot {...rest} href={String(markProps.mark.value)}
  ><span {@attach contentDOMRef}></span></DecorationRoot
>
