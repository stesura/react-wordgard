<!-- A link with chrome from the editor state: a marker while the cursor is in "bc". -->
<script lang="ts">
  import type { MarkComponentProps } from "../../../decorations/SvelteMarkType.js";
  import { useEditorState } from "../../../hooks/useEditorState.svelte.js";

  let { markProps, contentDOMRef, ...rest }: MarkComponentProps = $props();
  const state = useEditorState();
  const here = $derived(state.current.selection.from > 2 && state.current.selection.from < 4);
</script>

<span {...rest} class="cursor"
  ><span class="marker"
    >{#if here}<i class="here">*</i>{/if}</span
  ><span {@attach contentDOMRef}></span></span
>
