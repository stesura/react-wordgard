<!-- The document between two components logging their effects, all shown while `show` says. -->
<script lang="ts">
  import type { GardState } from "wordgard/state";

  import WordgardDoc from "../../../components/WordgardDoc.svelte";
  import WordgardEditor from "../../../components/WordgardEditor.svelte";
  import Grab from "./Grab.svelte";
  import Logged from "./Logged.svelte";

  let { doc, config, show }: { doc: string; config: GardState.Extension; show: boolean } = $props();
</script>

<WordgardEditor {doc} {config}>
  <Grab />
  {#if show}<Logged name="before" /><WordgardDoc /><Logged name="after" />{/if}
</WordgardEditor>
