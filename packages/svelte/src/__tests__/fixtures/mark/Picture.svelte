<!-- An image's widget. -->
<script lang="ts">
  import type { WidgetComponentProps } from "../../../decorations/SvelteWidgetType.js";

  let { value, ...rest }: WidgetComponentProps<null> = $props();
</script>

<img {...rest} src="data:," alt="A picture" />
