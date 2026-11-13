<!-- A widget showing the place it's drawn in, from its context, and the document's block count. -->
<script lang="ts">
  import { getContext } from "svelte";

  import type { WidgetComponentProps } from "../../../decorations/SvelteWidgetType.js";
  import { useEditorState } from "../../../hooks/useEditorState.svelte.js";

  let { value, ...rest }: WidgetComponentProps<string> = $props();
  const place = getContext<string>("place");
  const state = useEditorState();
</script>

<span {...rest} class="w">{place}:{state.current.doc.content.length}</span>
