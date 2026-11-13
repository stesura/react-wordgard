<!--
  Adapted from react-wordgard's WordgardDoc (by way of vue-wordgard's) for Svelte: the editor's
  element, in a div taking the attributes, its document drawn by our renderer once the div is in the
  page (an attachment), its components given this component's contexts. Unmounting it unmounts them.
  The editor is put in the page, which connects it, before the document is drawn: Svelte runs the
  components' effects as it draws them, where React and Vue run them after.
-->
<script lang="ts">
  import { getAllContexts, onDestroy } from "svelte";
  import type { Attachment } from "svelte/attachments";

  import { editorOf } from "@stesura/wordgard-view";
  import { svelteDoc } from "../SvelteDocTile.js";
  import { useEditorContext } from "../contexts/EditorContext.js";

  let attributes: Record<string, unknown> = $props();
  const { wg } = useEditorContext("WordgardDoc");
  const doc = svelteDoc(wg.contentDOM);
  const contexts = new Map(getAllContexts());
  // Released as soon as it goes, for a WordgardDoc mounted in its place.
  onDestroy(doc.claim());
  const attach: Attachment<HTMLDivElement> = (element) => {
    let detach: () => void;
    try {
      detach = doc.attach(contexts, () => element.appendChild(wg.dom));
    } catch (error) {
      if (wg.dom.parentNode == element) wg.dom.remove();
      throw error;
    }
    // Effects waiting for the editor to be in the page.
    editorOf(wg).requestEffects();
    return () => {
      // Not when another WordgardDoc has it already.
      if (wg.dom.parentNode == element) wg.dom.remove();
      detach();
    };
  };
</script>

<div {...attributes} {@attach attach}></div>
