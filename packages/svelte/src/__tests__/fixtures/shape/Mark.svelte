<!-- A widget in a cell's content. -->
<script lang="ts">
  import type { WidgetComponentProps } from "../../../decorations/SvelteWidgetType.js";

  let { value, ...rest }: WidgetComponentProps<null> = $props();
</script>

<i {...rest} class="svelte"></i>
