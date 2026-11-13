<!-- The document in place "a" while `first` says, else in place "b", drawn before it. -->
<script lang="ts">
  import type { GardState } from "wordgard/state";

  import WordgardDoc from "../../../components/WordgardDoc.svelte";
  import WordgardEditor from "../../../components/WordgardEditor.svelte";
  import Grab from "./Grab.svelte";
  import Place from "./Place.svelte";

  let { doc, config, first }: { doc: string; config: GardState.Extension; first: boolean } =
    $props();
</script>

<WordgardEditor {doc} {config}>
  <Grab />
  <Place name="b"
    >{#if !first}<WordgardDoc class="b" />{/if}</Place
  >
  <Place name="a"
    >{#if first}<WordgardDoc class="a" />{/if}</Place
  >
</WordgardEditor>
