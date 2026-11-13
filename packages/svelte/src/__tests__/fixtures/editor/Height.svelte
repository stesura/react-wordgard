<!-- A widget showing the height of the paragraph it starts, logging what it reads as "reads". -->
<script lang="ts">
  import type { WidgetComponentProps } from "../../../decorations/SvelteWidgetType.js";
  import { useEditorLayoutEffect } from "../../../hooks/useEditorLayoutEffect.js";
  import { log } from "./probes.js";

  let { value, ...rest }: WidgetComponentProps<string> = $props();
  let height = $state(0);
  useEditorLayoutEffect({
    read: (wg) => {
      const read = wg.contentDOM.firstElementChild?.getBoundingClientRect().height ?? 0;
      log("reads", read);
      return read;
    },
    write: (value) => {
      height = value;
    },
  });
</script>

<span {...rest} class="h">{value}{height}</span>
