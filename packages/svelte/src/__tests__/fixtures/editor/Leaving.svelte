<!-- The document in an element that leaves with a transition when `on` turns false. -->
<script lang="ts">
  import type { GardState } from "wordgard/state";

  import WordgardDoc from "../../../components/WordgardDoc.svelte";
  import WordgardEditor from "../../../components/WordgardEditor.svelte";
  import Grab from "./Grab.svelte";

  let { doc, config, on }: { doc: string; config: GardState.Extension; on: boolean } = $props();
  const leave = (_: Element) => ({ duration: 100 });
</script>

<WordgardEditor {doc} {config}>
  <Grab />
  {#if on}<div class="leaving" out:leave><WordgardDoc /></div>{/if}
</WordgardEditor>
