<!-- Sets the "frame" context for what it holds. -->
<script lang="ts">
  import { type Snippet, setContext } from "svelte";

  let { children }: { children: Snippet } = $props();
  setContext("frame", "framed");
</script>

{@render children()}
