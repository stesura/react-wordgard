<!--
  Not in react-wordgard: what every Svelte decoration's component is mounted in. Its boundary
  catches what the component throws, in its own updates too; its anchors and the boundary's land in
  the holder (helpers/mountRoot.ts), beside the root, not in the document.
-->
<script lang="ts">
  import type { Component } from "svelte";

  import type { Box } from "../helpers/box.svelte.js";

  type Props = {
    drawn: Box<{ component: Component<Record<string, unknown>>; props: Record<string, unknown> }>;
    onerror: (error: unknown) => void;
  };

  let { drawn, onerror }: Props = $props();
  const Drawn = $derived(drawn.current.component);
</script>

<svelte:boundary {onerror}><Drawn {...drawn.current.props} /></svelte:boundary>
