<!-- A widget drawing a horizontal rule. -->
<script lang="ts">
  import DecorationRoot from "../../components/DecorationRoot.svelte";
  import type { WidgetComponentProps } from "../../decorations/SvelteWidgetType.js";

  let { value, ...rest }: WidgetComponentProps<null> = $props();
</script>

<DecorationRoot {...rest} />
