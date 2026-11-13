<!-- A mark with an {#if} beside its content element: a mistake. -->
<script lang="ts">
  import type { MarkComponentProps } from "../../../decorations/SvelteMarkType.js";

  let { markProps, contentDOMRef, ...rest }: MarkComponentProps = $props();
  let shown = $state(false);
</script>

<span {...rest}
  >{#if shown}<i>*</i>{/if}<span {@attach contentDOMRef}></span></span
>
