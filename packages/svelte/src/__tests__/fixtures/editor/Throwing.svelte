<!-- A widget throwing as it's set up. -->
<script lang="ts">
  import type { WidgetComponentProps } from "../../../decorations/SvelteWidgetType.js";

  let { value }: WidgetComponentProps<string> = $props();
  const fail = () => {
    throw new Error("widget");
  };
  fail();
</script>

<span>{value}</span>
