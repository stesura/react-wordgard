<!--
  A link: an icon and a title from its state, the content in span.text. A mark's root can't hold
  an {#if}'s anchor, so the icon's is in i.icon.
-->
<script lang="ts">
  import type { MarkComponentProps } from "../../../decorations/SvelteMarkType.js";
  import { useWordgard } from "../../../hooks/useWordgard.js";
  import { join } from "./state.svelte.js";

  let { markProps, contentDOMRef, ...rest }: MarkComponentProps = $props();
  const s = join(useWordgard(), "link", () => markProps.getPos(), { icon: true, title: "a" });
</script>

<a {...rest} href={String(markProps.mark.value)} title={s.title}
  ><i class="icon"
    >{#if s.icon}^{/if}</i
  ><span class="text" {@attach contentDOMRef}></span></a
>
