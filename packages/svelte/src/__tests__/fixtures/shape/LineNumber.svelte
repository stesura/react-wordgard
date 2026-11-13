<!-- A tag widget at a paragraph's start: the line number its shape gives. -->
<script lang="ts">
  import { getContext } from "svelte";

  import type { WidgetComponentProps } from "../../../decorations/SvelteWidgetType.js";
  import { type Current, Line } from "./state.js";

  let { value, ...rest }: WidgetComponentProps<null> = $props();
  const line = getContext<Current<number> | undefined>(Line) ?? { current: 0 };
</script>

<span {...rest} class="line" aria-hidden="true">{line.current}</span>
