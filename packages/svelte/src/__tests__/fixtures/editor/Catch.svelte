<!-- Logs, as "caught", what the components in it throw. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  import { log } from "./probes.js";

  let { children }: { children: Snippet } = $props();
  const onerror = (error: unknown) =>
    log("caught", error instanceof Error ? error.message : String(error));
</script>

<svelte:boundary {onerror}>{@render children()}</svelte:boundary>
