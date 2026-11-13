<!--
  Adapted from vue-wordgard's WrappedNode for Svelte: a node wrapper's root, standing for the node
  it wraps. It draws nothing (the renderer draws the node, outside any template): it hands the node
  the contexts around it, and its attributes for the node's root element.
-->
<script lang="ts">
  import { getAllContexts } from "svelte";

  import { useWrappedContext } from "../contexts/WrappedContext.js";

  let attributes: Record<string, unknown> = $props();
  const wrapped = useWrappedContext();
  wrapped.wrap(new Map(getAllContexts()), () => ({ ...attributes }));
  $effect.pre(() => {
    void { ...attributes };
    wrapped.changed();
  });
</script>
