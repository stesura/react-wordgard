<!-- Logs the editor's state ("states") and the document's text ("typed") whenever the state changes. -->
<script lang="ts">
  import { useEditorState } from "../../../hooks/useEditorState.svelte.js";
  import { useWordgard } from "../../../hooks/useWordgard.js";
  import { log } from "./probes.js";

  const state = useEditorState();
  const wg = useWordgard();
  $effect(() => {
    log("states", state.current);
    log("typed", wg.contentDOM.textContent);
  });
</script>
