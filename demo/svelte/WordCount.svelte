<!-- Adapted from react-wordgard's demo (demo/main.tsx, by way of vue-wordgard's) for Svelte. -->
<script lang="ts">
  import { useEditorState } from "@stesura/svelte-wordgard";

  const state = useEditorState();
  const words = $derived(state.current.doc.textContent().split(/\s+/).filter(Boolean).length);
</script>

<p class="word-count">{words} words</p>
