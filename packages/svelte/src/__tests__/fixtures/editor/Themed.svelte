<!-- A widget showing the app's theme and the frame it's drawn in, from their contexts. -->
<script lang="ts">
  import { getContext } from "svelte";

  import type { WidgetComponentProps } from "../../../decorations/SvelteWidgetType.js";

  let { value, ...rest }: WidgetComponentProps<string> = $props();
  const theme = getContext<{ readonly current: string }>("theme");
  const frame = getContext<string | undefined>("frame") ?? "none";
</script>

<span {...rest} class="w">{theme.current}:{frame}:{value}</span>
