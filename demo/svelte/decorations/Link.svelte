<!--
  Adapted from react-wordgard's demo (demo/decorations/Link.tsx, by way of vue-wordgard's) for
  Svelte: a link drawn by Svelte, hovering it shows a card with its target, chrome beside the marked
  text, in an element of its own: an `{#if}` would put its comment among the mark's elements.
-->
<script lang="ts">
  import { type MarkComponentProps, useStopEvent } from "@stesura/svelte-wordgard";

  let { markProps, contentDOMRef, ...rest }: MarkComponentProps = $props();
  let hover = $state(false);
  const href = $derived(String(markProps.mark.value));
  const host = $derived(new URL(href, location.href).host);
  useStopEvent(
    (_wg, event) => event.target instanceof Element && !!event.target.closest(".link-card")
  );
  const open = () => window.open(href, "_blank", "noopener");
</script>

<a {...rest} {href} onmouseenter={() => (hover = true)} onmouseleave={() => (hover = false)}
  ><span {@attach contentDOMRef}></span><span class="link-card" hidden={!hover}
    ><span>{host}</span><button type="button" onclick={open}>Open</button></span
  ></a
>
