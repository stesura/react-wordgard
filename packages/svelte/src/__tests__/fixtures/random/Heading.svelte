<!-- A heading drawn by DecorationRoot (its tag the node's level), a tone from its state. -->
<script lang="ts">
  import DecorationRoot from "../../../components/DecorationRoot.svelte";
  import type { ShapeComponentProps } from "../../../decorations/SvelteShapeType.js";
  import { useWordgard } from "../../../hooks/useWordgard.js";
  import { join } from "./state.svelte.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
  const s = join(useWordgard(), "heading", () => nodeProps.getPos(), { tone: "a" });
</script>

<DecorationRoot {...rest} data-tone={s.tone} content={contentDOMRef} />
