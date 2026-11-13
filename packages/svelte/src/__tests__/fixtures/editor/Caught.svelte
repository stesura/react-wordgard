<!-- The document in a Catch, shown while `on` says. -->
<script lang="ts">
  import type { GardState } from "wordgard/state";

  import WordgardDoc from "../../../components/WordgardDoc.svelte";
  import WordgardEditor from "../../../components/WordgardEditor.svelte";
  import Catch from "./Catch.svelte";
  import Grab from "./Grab.svelte";

  let { doc, config, on }: { doc: string; config: GardState.Extension; on: boolean } = $props();
</script>

<WordgardEditor {doc} {config}>
  <Grab />
  <Catch
    >{#if on}<WordgardDoc />{/if}</Catch
  >
</WordgardEditor>
