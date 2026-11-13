<!-- A paragraph's wrapper: a header from its state, what it wraps in div.b, or in div.a. -->
<script lang="ts">
  import type { WrapperComponentProps } from "../../../decorations/SvelteWrapperType.js";
  import { useWordgard } from "../../../hooks/useWordgard.js";
  import { join } from "./state.svelte.js";

  let { nodeProps, wrappedDOMRef, ...rest }: WrapperComponentProps = $props();
  const s = join(useWordgard(), "frame", () => nodeProps.getPos(), { header: true, first: false });
</script>

<section {...rest}>
  {#if s.header}<header>Frame</header>{/if}
  <div class="a" {@attach s.first && wrappedDOMRef}></div>
  <div class="b" {@attach !s.first && wrappedDOMRef}></div>
</section>
