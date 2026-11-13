<!-- A widget drawing an image. -->
<script lang="ts">
  import type { WidgetComponentProps } from "../../../decorations/SvelteWidgetType.js";

  let { value, ...rest }: WidgetComponentProps<null> = $props();
</script>

<img {...rest} class="picture" alt="" />
