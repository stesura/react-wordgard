<!--
  Adapted from react-wordgard's demo (demo/main.tsx, by way of vue-wordgard's) for Svelte: the
  editor in the app, with its menus beside the document.
-->
<script lang="ts">
  import { docFor } from "../doc.js";
  import { WordgardDoc, WordgardEditor } from "@stesura/svelte-wordgard";
  import Expose from "./Expose.svelte";
  import InsertImage from "./InsertImage.svelte";
  import MentionMenu from "./MentionMenu.svelte";
  import TextMenu from "./TextMenu.svelte";
  import WordCount from "./WordCount.svelte";
  import { config } from "./config.js";

  const doc = docFor("svelte-wordgard", "Svelte");
</script>

<WordgardEditor {doc} {config}>
  <Expose />
  <WordgardDoc />
  <InsertImage />
  <TextMenu />
  <MentionMenu />
  <WordCount />
</WordgardEditor>
