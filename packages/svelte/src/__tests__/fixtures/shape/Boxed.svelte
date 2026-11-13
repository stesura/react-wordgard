<!-- A blockquote boxing its content in an extra element once the document has more than two blocks. -->
<script lang="ts">
  import type { ShapeComponentProps } from "../../../decorations/SvelteShapeType.js";
  import { useEditorState } from "../../../hooks/useEditorState.svelte.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
  const editorState = useEditorState();
  const boxed = $derived(editorState.current.doc.content.length > 2);
</script>

{#if boxed}
  <blockquote {...rest}><div class="box" {@attach contentDOMRef}></div></blockquote>
{:else}
  <blockquote {...rest} {@attach contentDOMRef}></blockquote>
{/if}
