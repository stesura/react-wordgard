<!-- A link: an icon, a title from its own state, and the content in span.text. -->
<script lang="ts">
  import type { MarkComponentProps } from "../../decorations/SvelteMarkType.js";
  import { useWordgard } from "../../hooks/useWordgard.js";
  import { register } from "./controls.js";

  let { markProps, contentDOMRef, ...rest }: MarkComponentProps = $props();
  let title = $state("a");
  register(useWordgard(), {
    set: (name, value) => {
      if (name == "title") title = String(value);
    },
    getPos: () => markProps.getPos(),
  });
</script>

<a {...rest} href={String(markProps.mark.value)} {title}
  ><i class="icon">^</i><span class="text" {@attach contentDOMRef}></span></a
>
