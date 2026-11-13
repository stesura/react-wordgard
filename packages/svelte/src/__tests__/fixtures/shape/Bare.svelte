<!-- A wrapper not drawing what it wraps: a mistake. -->
<script lang="ts">
  import type { WrapperComponentProps } from "../../../decorations/SvelteWrapperType.js";

  let { nodeProps, wrappedDOMRef, ...rest }: WrapperComponentProps = $props();
</script>

<section {...rest}></section>
