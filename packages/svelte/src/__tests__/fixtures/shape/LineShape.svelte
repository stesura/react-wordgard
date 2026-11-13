<!-- A paragraph telling its line number widget the number, from its own state. -->
<script lang="ts">
  import { setContext } from "svelte";

  import type { ShapeComponentProps } from "../../../decorations/SvelteShapeType.js";
  import { useWordgard } from "../../../hooks/useWordgard.js";
  import { type Current, Line, enlist } from "./state.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
  let line = $state(1);
  const value: Current<number> = {
    get current() {
      return line;
    },
  };
  setContext(Line, value);
  enlist(useWordgard(), "line", {
    set: (name, next) => {
      if (name == "line") line = Number(next);
    },
    getPos: () => nodeProps.getPos(),
  });
</script>

<!-- The attachment on the root: the widget gets the paragraph's context. -->
<p {...rest} {@attach contentDOMRef}></p>
