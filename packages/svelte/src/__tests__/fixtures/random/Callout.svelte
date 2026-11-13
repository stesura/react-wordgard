<!-- A blockquote's shape: a bar from its state, the content in div.body, or in div.deep > b. -->
<script lang="ts">
  import type { ShapeComponentProps } from "../../../decorations/SvelteShapeType.js";
  import { useWordgard } from "../../../hooks/useWordgard.js";
  import { join } from "./state.svelte.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
  const s = join(useWordgard(), "callout", () => nodeProps.getPos(), { bar: true, deep: false });
</script>

<div {...rest}>
  {#if s.bar}<div class="bar">Bar <b>x</b></div>{/if}
  {#if s.deep}
    <div class="deep"><b {@attach contentDOMRef}></b></div>
  {:else}
    <div class="body" {@attach contentDOMRef}></div>
  {/if}
</div>
