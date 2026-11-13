<!-- An inline atom (a mention-like chip): its name, and a card shown from its own state. -->
<script lang="ts">
  import type { ShapeComponentProps } from "../../../decorations/SvelteShapeType.js";
  import { useWordgard } from "../../../hooks/useWordgard.js";
  import { counted, enlist, start } from "./state.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
  let open = $state(start.open);
  const name = $derived(nodeProps.node.isLeaf ? String(nodeProps.node.param) : "");
  counted.chipMounts++;
  enlist(useWordgard(), "chip", {
    set: (key, value) => {
      if (key == "open") open = value == true;
    },
    getPos: () => nodeProps.getPos(),
  });
</script>

<span {...rest}
  >@{name}{#if open}<b class="card">card</b>{/if}</span
>
