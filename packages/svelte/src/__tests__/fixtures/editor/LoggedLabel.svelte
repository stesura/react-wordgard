<!-- A widget logging, as "callbacks", whether its element is in the page when its effect runs. -->
<script lang="ts">
  import type { WidgetComponentProps } from "../../../decorations/SvelteWidgetType.js";
  import { log } from "./probes.js";

  let { value, ...rest }: WidgetComponentProps<string> = $props();
  let element: HTMLElement | undefined = $state();
  $effect(() => log("callbacks", `widget ${element?.isConnected}`));
</script>

<span {...rest} bind:this={element} class="w">{value}</span>
