<!-- Chrome before the content: a bar shown from its own state, then a list. -->
<script lang="ts">
  import DecorationRoot from "../../../components/DecorationRoot.svelte";
  import type { ShapeComponentProps } from "../../../decorations/SvelteShapeType.js";
  import { useWordgard } from "../../../hooks/useWordgard.js";
  import { register } from "../controls.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
  let open = $state(true);
  const items = ["a", "b"];
  register(useWordgard(), {
    set: (name, value) => {
      if (name == "open") open = value == true;
    },
    getPos: () => nodeProps.getPos(),
  });
</script>

<DecorationRoot {...rest}>
  {#if open}<div class="bar">bar</div>{/if}
  {#each items as item, i (i)}<div class="item">{item}</div>{/each}
  <div class="body" {@attach contentDOMRef}></div>
</DecorationRoot>
