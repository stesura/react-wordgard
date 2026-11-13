<!--
  When `bump` changes, its effect dispatches an "x" at 1, then reads the layout, which forces a
  flush there: it logs the error as "errors".
-->
<script lang="ts">
  import { Leaf } from "wordgard/doc";

  import { useWordgard } from "../../../hooks/useWordgard.js";
  import { bump, log } from "./probes.js";

  const wg = useWordgard();
  $effect(() => {
    if (!bump.current) return;
    wg.dispatch({ changes: { from: 1, insert: [Leaf.text("x")] } });
    try {
      wg.coordsAtPos(1);
    } catch (error) {
      log("errors", error instanceof Error ? error.message : String(error));
    }
  });
</script>

<i>{bump.current}</i>
