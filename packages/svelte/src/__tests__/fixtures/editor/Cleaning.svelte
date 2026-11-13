<!-- A useEditorEffect over the block count, logging its runs and cleanups as "effect". -->
<script lang="ts">
  import { useEditorEffect } from "../../../hooks/useEditorEffect.svelte.js";
  import { useEditorState } from "../../../hooks/useEditorState.svelte.js";
  import { log } from "./probes.js";

  const state = useEditorState();
  const blocks = $derived(state.current.doc.content.length);
  useEditorEffect(
    () => {
      const count = blocks;
      log("effect", `run ${count}`);
      return () => log("effect", `clean ${count}`);
    },
    () => blocks
  );
</script>
