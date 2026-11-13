<!--
  An editor in the app's components: a toolbar, the `probes`, `toggled` while `toggle` says, then
  the document, shown while `show` says.
-->
<script lang="ts">
  import type { Component } from "svelte";
  import type { GardState } from "wordgard/state";

  import WordgardDoc from "../../../components/WordgardDoc.svelte";
  import WordgardEditor from "../../../components/WordgardEditor.svelte";
  import Grab from "./Grab.svelte";
  import Toolbar from "./Toolbar.svelte";
  import { toggle } from "./probes.js";

  let {
    doc,
    config,
    show = true,
    probes = [],
    toggled,
  }: {
    doc: string;
    config: GardState.Extension;
    show?: boolean;
    probes?: Component[];
    toggled?: Component;
  } = $props();
</script>

<WordgardEditor {doc} {config}>
  <Grab />
  <Toolbar />
  {#each probes as Probe, i (i)}<Probe />{/each}
  {#if toggled && toggle.current}{@const Toggled = toggled}<Toggled />{/if}
  {#if show}<WordgardDoc class="editor" />{/if}
</WordgardEditor>
