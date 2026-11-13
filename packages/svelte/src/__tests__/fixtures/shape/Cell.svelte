<!-- A cell clipping its content in an extra element when its row says so: its root replaced. -->
<script lang="ts">
  import { getContext } from "svelte";

  import type { ShapeComponentProps } from "../../../decorations/SvelteShapeType.js";
  import { type Current, Exact } from "./state.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
  const exact = getContext<Current<boolean> | undefined>(Exact) ?? { current: false };
</script>

{#if exact.current}
  <td {...rest}><div class="clip" {@attach contentDOMRef}></div></td>
{:else}
  <td {...rest} {@attach contentDOMRef}></td>
{/if}
