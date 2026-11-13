<!-- A widget drawn by DecorationRoot: its value, and which mount it is. -->
<script lang="ts">
  import DecorationRoot from "../../../components/DecorationRoot.svelte";
  import type { WidgetComponentProps } from "../../../decorations/SvelteWidgetType.js";
  import { counts } from "./state.js";

  let { value, class: classes, ...rest }: WidgetComponentProps<string> = $props();
  const mount = ++counts.badges;
</script>

<DecorationRoot {...rest} class={["badge", classes]} data-mount={mount}>{value}</DecorationRoot>
