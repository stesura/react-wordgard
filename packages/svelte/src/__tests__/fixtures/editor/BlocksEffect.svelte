<!-- A useEditorEffect over the block count, logging it as "seen". -->
<script lang="ts">
  import { useEditorEffect } from "../../../hooks/useEditorEffect.svelte.js";
  import { useEditorState } from "../../../hooks/useEditorState.svelte.js";
  import { log } from "./probes.js";

  const state = useEditorState();
  const blocks = $derived(state.current.doc.content.length);
  useEditorEffect(
    () => log("seen", blocks),
    () => blocks
  );
</script>
