<!-- A widget: its value, "index.version", and a count from its state. -->
<script lang="ts">
  import type { WidgetComponentProps } from "../../../decorations/SvelteWidgetType.js";
  import { useWordgard } from "../../../hooks/useWordgard.js";
  import { join } from "./state.svelte.js";

  let { value, ...rest }: WidgetComponentProps<string> = $props();
  const s = join(useWordgard(), "counter", () => parseInt(value), { count: 0 });
</script>

<button {...rest} class="counter" data-value={value}>{value}:{s.count}</button>
