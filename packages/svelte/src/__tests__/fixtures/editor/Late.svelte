<!-- A useEditorEffect inserting "z" and logging, as "lefts", where position 2 is. -->
<script lang="ts">
  import { Leaf } from "wordgard/doc";

  import { useEditorEffect } from "../../../hooks/useEditorEffect.svelte.js";
  import { log } from "./probes.js";

  useEditorEffect((wg) => {
    wg.dispatch({ changes: { from: 1, insert: [Leaf.text("z")] } });
    log("lefts", wg.coordsAtPos(2).left);
  });
</script>
