<!-- Sets the "place" context, its name, for what it holds. -->
<script lang="ts">
  import { type Snippet, setContext, untrack } from "svelte";

  let { name, children }: { name: string; children: Snippet } = $props();
  setContext(
    "place",
    untrack(() => name)
  );
</script>

{@render children()}
