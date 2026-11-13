<!-- A widget drawn by DecorationRoot: its value. -->
<script lang="ts">
  import DecorationRoot from "../../../components/DecorationRoot.svelte";
  import type { WidgetComponentProps } from "../../../decorations/SvelteWidgetType.js";

  let { value, ...rest }: WidgetComponentProps<string> = $props();
</script>

<DecorationRoot {...rest}>{value}</DecorationRoot>
