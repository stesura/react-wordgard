<!-- A shape whose effect reads the editor's layout when told to, which forces a flush there. -->
<script lang="ts">
  import type { ShapeComponentProps } from "../../decorations/SvelteShapeType.js";
  import { useWordgard } from "../../hooks/useWordgard.js";
  import { register } from "./controls.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
  const wg = useWordgard();
  let measure = $state(0);
  let refused = $state("no");
  register(wg, {
    set: () => measure++,
    getPos: () => nodeProps.getPos(),
  });
  $effect(() => {
    if (!measure) return;
    try {
      wg.coordsAtPos(nodeProps.getPos());
    } catch (error) {
      refused = String(error);
    }
  });
</script>

<div {...rest} data-refused={refused}><div {@attach contentDOMRef}></div></div>
