<!-- A root holding the content, tinted from its own state, Wordgard's style kept. -->
<script lang="ts">
  import DecorationRoot from "../../../components/DecorationRoot.svelte";
  import type { ShapeComponentProps } from "../../../decorations/SvelteShapeType.js";
  import { useWordgard } from "../../../hooks/useWordgard.js";
  import { register } from "../controls.js";

  let { nodeProps, contentDOMRef, style, ...rest }: ShapeComponentProps = $props();
  let tint = $state(false);
  register(useWordgard(), {
    set: (name, value) => {
      if (name == "tint") tint = value == true;
    },
    getPos: () => nodeProps.getPos(),
  });
</script>

<DecorationRoot
  {...rest}
  content={contentDOMRef}
  style={[tint && "color: red", style].filter(Boolean).join("; ")}
/>
