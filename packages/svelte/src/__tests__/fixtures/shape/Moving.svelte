<!-- A wrapper putting what it wraps in div.b, or in div.a once `first` is set. -->
<script lang="ts">
  import type { WrapperComponentProps } from "../../../decorations/SvelteWrapperType.js";
  import { useWordgard } from "../../../hooks/useWordgard.js";
  import { enlist, start } from "./state.js";

  let { nodeProps, wrappedDOMRef, ...rest }: WrapperComponentProps = $props();
  let first = $state(start.first);
  enlist(useWordgard(), "moving", {
    set: (name, value) => {
      if (name == "first") first = value == true;
    },
    getPos: () => nodeProps.getPos(),
  });
</script>

<section {...rest}>
  <div class="a" {@attach first && wrappedDOMRef}></div>
  <div class="b" {@attach !first && wrappedDOMRef}></div>
</section>
