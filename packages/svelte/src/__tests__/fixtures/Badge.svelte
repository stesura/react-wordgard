<!-- A widget: its value, the context of the shape it's drawn in, and a click counter. -->
<script lang="ts">
  import { getContext, onDestroy } from "svelte";

  import type { WidgetComponentProps } from "../../decorations/SvelteWidgetType.js";
  import { live } from "./controls.js";

  let { value, ...rest }: WidgetComponentProps<string> = $props();
  const tone = getContext<string | undefined>("tone") ?? "none";
  let clicks = $state(0);
  live("badge", 1);
  onDestroy(() => live("badge", -1));
</script>

<button {...rest} class="badge" data-tone={tone} onclick={() => clicks++}>{value}{clicks}</button>
