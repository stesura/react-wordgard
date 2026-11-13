<!-- An effect over the state, logging the block count as "seen", which moves the selection at 4. -->
<script lang="ts">
  import { useEditorState } from "../../../hooks/useEditorState.svelte.js";
  import { useWordgard } from "../../../hooks/useWordgard.js";
  import { log } from "./probes.js";

  const state = useEditorState();
  const wg = useWordgard();
  $effect(() => {
    const blocks = state.current.doc.content.length;
    log("seen", blocks);
    if (blocks == 4) wg.dispatch({ selection: { anchor: 1 } });
  });
</script>
