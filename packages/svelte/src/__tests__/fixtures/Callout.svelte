<!--
  A title bar shown from its own state (an {#if} in the root's chrome), a label from its own state,
  a context for what its content draws, and the content in div.body, or in div.deep > b when deep.
-->
<script lang="ts">
  import { onDestroy, setContext } from "svelte";

  import type { ShapeComponentProps } from "../../decorations/SvelteShapeType.js";
  import { useWordgard } from "../../hooks/useWordgard.js";
  import { initial, live, register } from "./controls.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
  let bar = $state(initial.bar);
  let deep = $state(initial.deep);
  let label = $state("a");
  setContext("tone", "warm");
  register(useWordgard(), {
    set: (name, value) => {
      if (name == "bar") bar = value == true;
      if (name == "deep") deep = value == true;
      if (name == "label") label = String(value);
    },
    getPos: () => nodeProps.getPos(),
  });
  live("callout", 1);
  onDestroy(() => live("callout", -1));
</script>

<div {...rest} data-label={label}>
  {#if bar}<div class="bar">Bar <b>x</b></div>{/if}
  {#if deep}
    <div class="deep"><b {@attach contentDOMRef}></b></div>
  {:else}
    <div class="body" {@attach contentDOMRef}></div>
  {/if}
</div>
