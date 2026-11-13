<!-- A wrapper drawn by DecorationRoot: what it wraps first, then a handle. -->
<script lang="ts">
  import DecorationRoot from "../../../components/DecorationRoot.svelte";
  import type { WrapperComponentProps } from "../../../decorations/SvelteWrapperType.js";

  let { nodeProps, wrappedDOMRef, ...rest }: WrapperComponentProps = $props();
</script>

<DecorationRoot {...rest} class="frame" {@attach wrappedDOMRef}>
  <span aria-hidden="true">⋮</span>
</DecorationRoot>
