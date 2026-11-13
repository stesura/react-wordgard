<!--
  Adapted from react-wordgard's demo (demo/main.tsx's image widget, by way of vue-wordgard's) for
  Svelte: an image drawn by Svelte, with state of its own: hovering outlines it.
-->
<script lang="ts">
  import type { WidgetComponentProps } from "@stesura/svelte-wordgard";

  let { value, ...rest }: WidgetComponentProps<string> = $props();
  let hover = $state(false);
</script>

<img
  {...rest}
  src={value}
  alt=""
  style:outline={hover ? "2px solid #6af" : undefined}
  onmouseenter={() => (hover = true)}
  onmouseleave={() => (hover = false)}
/>
