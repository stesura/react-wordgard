<!-- Sets the "theme" context from its prop; the document in a Framed, between the editor and it. -->
<script lang="ts">
  import { setContext } from "svelte";
  import type { GardState } from "wordgard/state";

  import WordgardDoc from "../../../components/WordgardDoc.svelte";
  import WordgardEditor from "../../../components/WordgardEditor.svelte";
  import Framed from "./Framed.svelte";
  import Grab from "./Grab.svelte";

  let { doc, config, theme }: { doc: string; config: GardState.Extension; theme: string } =
    $props();
  setContext("theme", {
    get current() {
      return theme;
    },
  });
</script>

<WordgardEditor {doc} {config}>
  <Grab />
  <Framed><WordgardDoc /></Framed>
</WordgardEditor>
