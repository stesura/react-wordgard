<!-- A mark drawing <a> where its mark says <span>: a mistake. -->
<script lang="ts">
  import type { MarkComponentProps } from "../../../decorations/SvelteMarkType.js";

  let { markProps, contentDOMRef, ...rest }: MarkComponentProps = $props();
</script>

<a {...rest} {@attach contentDOMRef}></a>
