<!-- Stesura's exact rows: a row tells its cells, through a context, to clip their content. -->
<script lang="ts">
  import { setContext } from "svelte";

  import type { ShapeComponentProps } from "../../../decorations/SvelteShapeType.js";
  import { useWordgard } from "../../../hooks/useWordgard.js";
  import { type Current, Exact, enlist, start } from "./state.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
  let exact = $state(start.exact);
  const value: Current<boolean> = {
    get current() {
      return exact;
    },
  };
  setContext(Exact, value);
  enlist(useWordgard(), "row", {
    set: (name, next) => {
      if (name == "exact") exact = next == true;
    },
    getPos: () => nodeProps.getPos(),
  });
</script>

<!-- The attachment on the root: the cells get the row's context. -->
<tr {...rest} {@attach contentDOMRef}></tr>
