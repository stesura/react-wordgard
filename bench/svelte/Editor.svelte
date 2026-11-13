<!-- svelte-wordgard mounted as an app does, for editors.ts. -->
<script lang="ts">
  import type { Wordgard } from "wordgard/editor";
  import type { GardState } from "wordgard/state";

  import { WordgardDoc, WordgardEditor } from "@stesura/svelte-wordgard";
  import Ready from "./Ready.svelte";

  let { editorState, ready }: { editorState: GardState; ready: (wg: Wordgard) => void } = $props();
</script>

<WordgardEditor state={editorState}>
  <WordgardDoc />
  <Ready {ready} />
</WordgardEditor>
