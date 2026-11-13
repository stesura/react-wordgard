<!-- Logs, as "blocks", the document's block count, a $derived over the state, when it changes. -->
<script lang="ts">
  import { useEditorState } from "../../../hooks/useEditorState.svelte.js";
  import { log } from "./probes.js";

  const state = useEditorState();
  const count = $derived(state.current.doc.content.length);
  $effect(() => log("blocks", count));
</script>
