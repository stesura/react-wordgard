<!-- A page as SvelteKit renders it on the server, then hydrates: an editor between static parts. -->
<script lang="ts">
  import { Decoration } from "wordgard/editor";
  import { basicSchema, blockquote } from "wordgard/schema";
  import { Blockquote } from "wordgard/types";

  import WordgardDoc from "../../../components/WordgardDoc.svelte";
  import WordgardEditor from "../../../components/WordgardEditor.svelte";
  import { createShape } from "../../../decorations/SvelteShapeType.js";
  import Note from "./Note.svelte";
  import Status from "./Status.svelte";

  const config = [basicSchema(), blockquote(), Decoration.Tag.shape(Blockquote, createShape(Note))];
</script>

<h1>Title</h1>
<WordgardEditor doc="<p>Hello</p><blockquote><p>quoted</p></blockquote>" {config}>
  <Status />
  <WordgardDoc class="editor" />
</WordgardEditor>
<footer>After</footer>
