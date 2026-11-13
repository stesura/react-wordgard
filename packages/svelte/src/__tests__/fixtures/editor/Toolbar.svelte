<!-- Outside the document: the selection's head, from the editor's state. -->
<script lang="ts">
  import { useEditorState } from "../../../hooks/useEditorState.svelte.js";

  const state = useEditorState();
  const head = $derived(state.current.selection.head);
</script>

<output class="head">{head}</output>
