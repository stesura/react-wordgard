<!-- A widget: its value in span.w, as the tests' `label` draws it for plain Wordgard. -->
<script lang="ts">
  import type { WidgetComponentProps } from "../../../decorations/SvelteWidgetType.js";

  let { value, ...rest }: WidgetComponentProps<string> = $props();
</script>

<span {...rest} class="w">{value}</span>
