<!-- A table's wrapper: what it wraps, then a grip. -->
<script lang="ts">
  import type { WrapperComponentProps } from "../../../decorations/SvelteWrapperType.js";

  let { nodeProps, wrappedDOMRef, ...rest }: WrapperComponentProps = $props();
</script>

<div {...rest} class={["tableWrapper", rest["class"]]} {@attach wrappedDOMRef}>
  <span class="grip" aria-hidden="true">⋮</span>
</div>
