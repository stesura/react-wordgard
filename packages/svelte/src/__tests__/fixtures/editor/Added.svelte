<!-- A second WordgardDoc for an editor already drawn, added when `second` turns true: a mistake. -->
<script lang="ts">
  import type { GardState } from "wordgard/state";

  import WordgardDoc from "../../../components/WordgardDoc.svelte";
  import WordgardEditor from "../../../components/WordgardEditor.svelte";
  import Catch from "./Catch.svelte";
  import Grab from "./Grab.svelte";

  let { doc, config, second }: { doc: string; config: GardState.Extension; second: boolean } =
    $props();
</script>

<WordgardEditor {doc} {config}>
  <Grab />
  <WordgardDoc class="first" />
  <Catch
    >{#if second}<WordgardDoc />{/if}</Catch
  >
</WordgardEditor>
