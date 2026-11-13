<!-- Two WordgardDocs for one editor: a mistake. -->
<script lang="ts">
  import type { GardState } from "wordgard/state";

  import WordgardDoc from "../../../components/WordgardDoc.svelte";
  import WordgardEditor from "../../../components/WordgardEditor.svelte";
  import Catch from "./Catch.svelte";
  import Grab from "./Grab.svelte";

  let { doc, config }: { doc: string; config: GardState.Extension } = $props();
</script>

<WordgardEditor {doc} {config}>
  <Grab />
  <Catch><WordgardDoc /><WordgardDoc /></Catch>
</WordgardEditor>
