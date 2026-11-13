<!-- Logs, as "callbacks", whether its element is in the page when its effect runs. -->
<script lang="ts">
  import { log } from "./probes.js";

  let { name }: { name: string } = $props();
  let element: HTMLElement | undefined = $state();
  $effect(() => log("callbacks", `${name} ${element?.isConnected}`));
</script>

<i bind:this={element}></i>
