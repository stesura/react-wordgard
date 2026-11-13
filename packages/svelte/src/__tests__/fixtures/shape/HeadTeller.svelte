<!-- A blockquote showing the selection's head, throwing while `initial.fail` is set. -->
<script lang="ts">
  import type { ShapeComponentProps } from "../../../decorations/SvelteShapeType.js";
  import { useEditorState } from "../../../hooks/useEditorState.svelte.js";
  import { initial } from "../controls.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
  const editorState = useEditorState();
  const check = (head: number) => {
    if (initial.fail) throw new Error("boom");
    return head;
  };
</script>

<blockquote {...rest} data-head={check(editorState.current.selection.head)}></blockquote>
