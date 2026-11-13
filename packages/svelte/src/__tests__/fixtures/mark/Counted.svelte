<!-- A widget counting its renders. -->
<script lang="ts">
  import DecorationRoot from "../../../components/DecorationRoot.svelte";
  import type { WidgetComponentProps } from "../../../decorations/SvelteWidgetType.js";
  import { counts } from "./state.js";

  let { value, ...rest }: WidgetComponentProps<string> = $props();
  const draw = (text: string) => {
    counts.draws++;
    return text;
  };
</script>

<DecorationRoot {...rest}>{draw(value)}</DecorationRoot>
