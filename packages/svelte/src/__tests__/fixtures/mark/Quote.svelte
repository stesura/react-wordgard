<!--
  A quote with a decorative mark before its content, its class and style merged with Wordgard's, its
  data-kind its own.
-->
<script lang="ts">
  import DecorationRoot from "../../../components/DecorationRoot.svelte";
  import type { ShapeComponentProps } from "../../../decorations/SvelteShapeType.js";

  let { nodeProps, contentDOMRef, class: classes, style, ...rest }: ShapeComponentProps = $props();
</script>

<DecorationRoot
  {...rest}
  class={["quote", classes]}
  style={["color: red", style].filter(Boolean).join("; ")}
  data-kind="mine"
>
  <span aria-hidden="true">“</span>
  <div class="body" {@attach contentDOMRef}></div>
</DecorationRoot>
