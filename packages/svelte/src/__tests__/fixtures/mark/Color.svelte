<!-- A color mark: the content in its root, no chrome. -->
<script lang="ts">
  import type { MarkComponentProps } from "../../../decorations/SvelteMarkType.js";

  let { markProps, contentDOMRef, ...rest }: MarkComponentProps = $props();
</script>

<span {...rest} class="color" data-color={String(markProps.mark.value)}></span>
