<!--
  A link: an icon shown from its own state, a title from its own state, and the content in
  span.text, or in span.box > b when boxed. Its {#if} sits in an element of its own: the mark's
  elements down to its content element can't hold Svelte's anchors.
-->
<script lang="ts">
  import type { MarkComponentProps } from "../../../decorations/SvelteMarkType.js";
  import { useWordgard } from "../../../hooks/useWordgard.js";
  import { initial, registerLink } from "./state.js";

  let { markProps, contentDOMRef, ...rest }: MarkComponentProps = $props();
  let icon = $state(initial.icon);
  let boxed = $state(initial.boxed);
  let title = $state("a");
  registerLink(useWordgard(), {
    set: (name, value) => {
      if (name == "icon") icon = value == true;
      if (name == "boxed") boxed = value == true;
      if (name == "title") title = String(value);
    },
    getPos: () => markProps.getPos(),
    mark: () => markProps.mark,
  });
</script>

<a {...rest} href={String(markProps.mark.value)} {title}
  ><span class="icons"
    >{#if icon}<i class="icon">^</i>{/if}</span
  ><span class="box"><b {@attach boxed ? contentDOMRef : null}></b></span><span
    class="text"
    {@attach boxed ? null : contentDOMRef}
  ></span></a
>
