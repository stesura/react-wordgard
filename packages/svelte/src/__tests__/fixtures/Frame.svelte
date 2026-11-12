<!-- A wrapper: what it wraps first in its root, a header from its own state, and a footer. -->
<script lang="ts">
  import type { WrapperComponentProps } from "../../decorations/SvelteWrapperType.js";
  import { useWordgard } from "../../hooks/useWordgard.js";
  import { initial, register } from "./controls.js";

  let { nodeProps, wrappedDOMRef, ...rest }: WrapperComponentProps = $props();
  let header = $state(initial.header);
  register(useWordgard(), {
    set: (name, value) => {
      if (name == "header") header = value == true;
    },
    getPos: () => nodeProps.getPos(),
  });
</script>

<section {...rest} {@attach wrappedDOMRef}>
  {#if header}<header>Frame</header>{/if}
  <footer>end</footer>
</section>
