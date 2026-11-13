<!--
  A title bar shown from its own state (an {#if} in the root's chrome), a label from its own state,
  a count of the document's blocks once there are more than two (editor state), and the content in
  div.body.
-->
<script lang="ts">
  import type { ShapeComponentProps } from "../../../decorations/SvelteShapeType.js";
  import { useEditorState } from "../../../hooks/useEditorState.svelte.js";
  import { useWordgard } from "../../../hooks/useWordgard.js";
  import { initial } from "../controls.js";
  import { enlist } from "./state.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
  let bar = $state(initial.bar);
  let label = $state("a");
  const editorState = useEditorState();
  const blocks = $derived(editorState.current.doc.content.length);
  enlist(useWordgard(), "callout", {
    set: (name, value) => {
      if (name == "bar") bar = value == true;
      if (name == "label") label = String(value);
    },
    getPos: () => nodeProps.getPos(),
  });
</script>

<div {...rest} data-label={label}>
  {#if bar}<div class="bar">Bar <b>x</b></div>{/if}
  {#if blocks > 2}<span class="count">{blocks}</span>{/if}
  <div class="body" {@attach contentDOMRef}></div>
</div>
