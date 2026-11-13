<!--
  A wrapper: a header from its own state, a label from its own state, what it wraps first in its
  root or, deep, moved into div.deep from its own state, and a footer.
-->
<script lang="ts">
  import type { WrapperComponentProps } from "../../../decorations/SvelteWrapperType.js";
  import { useWordgard } from "../../../hooks/useWordgard.js";
  import { initial } from "../controls.js";
  import { enlist } from "./state.js";

  let { nodeProps, wrappedDOMRef, ...rest }: WrapperComponentProps = $props();
  let header = $state(initial.header);
  let label = $state("a");
  let deep = $state(initial.deep);
  enlist(useWordgard(), "frame", {
    set: (name, value) => {
      if (name == "header") header = value == true;
      if (name == "label") label = String(value);
      if (name == "deep") deep = value == true;
    },
    getPos: () => nodeProps.getPos(),
  });
</script>

<section {...rest} data-frame={label} {@attach !deep && wrappedDOMRef}>
  {#if header}<header>Frame <b>x</b></header>{/if}
  {#if deep}<div class="deep" {@attach wrappedDOMRef}></div>{/if}
  <footer>end</footer>
</section>
