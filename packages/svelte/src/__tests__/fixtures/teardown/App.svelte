<!-- An editor in an app, its document full of Svelte decorations; Grab hands the test the editor. -->
<script lang="ts">
  import type { GardState } from "wordgard/state";

  import WordgardDoc from "../../../components/WordgardDoc.svelte";
  import WordgardEditor from "../../../components/WordgardEditor.svelte";
  import Grab from "../editor/Grab.svelte";

  let { doc, config }: { doc: string; config: GardState.Extension } = $props();
</script>

<WordgardEditor {doc} {config}>
  <Grab />
  <WordgardDoc />
</WordgardEditor>
