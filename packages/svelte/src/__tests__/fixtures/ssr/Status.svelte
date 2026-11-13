<!-- A component beside the document, reading the editor's state. -->
<script lang="ts">
  import { useEditorState } from "../../../hooks/useEditorState.svelte.js";

  const editorState = useEditorState();
</script>

<output>{editorState.current.doc.length}</output>
