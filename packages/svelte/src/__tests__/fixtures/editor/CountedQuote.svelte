<!-- A blockquote's shape showing the document's length, logging it as "quote" when it changes. -->
<script lang="ts">
  import DecorationRoot from "../../../components/DecorationRoot.svelte";
  import type { ShapeComponentProps } from "../../../decorations/SvelteShapeType.js";
  import { useEditorState } from "../../../hooks/useEditorState.svelte.js";
  import { log } from "./probes.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
  const state = useEditorState();
  $effect(() => log("quote", state.current.doc.length));
</script>

<DecorationRoot {...rest} content={contentDOMRef} data-length={state.current.doc.length} />
