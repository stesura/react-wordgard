<!--
  A useEditorEffect over the state, logging as "seen" the text where the document starts; it moves
  the selection when the document has 4 blocks.
-->
<script lang="ts">
  import { useEditorEffect } from "../../../hooks/useEditorEffect.svelte.js";
  import { useEditorState } from "../../../hooks/useEditorState.svelte.js";
  import { log } from "./probes.js";

  const state = useEditorState();
  useEditorEffect(
    (wg) => {
      // Tiles over the new DOM, and the editor in the page.
      log("seen", wg.domAtPos(1, 1).node.textContent);
      if (state.current.doc.content.length == 4) wg.dispatch({ selection: { anchor: 2 } });
    },
    () => state.current
  );
</script>
