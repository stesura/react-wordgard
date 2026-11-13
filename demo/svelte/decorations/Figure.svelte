<!--
  Adapted from react-wordgard's demo (demo/decorations/Figure.tsx, by way of vue-wordgard's) for
  Svelte: a block image resized by dragging its handles, after Stesura's ImageResizeFrame,
  simplified: width only (Wordgard's ImageSize mark), the image itself previews the drag, and the
  size commits once, on release. A widget drawing the figure node: the node's attributes (its alt
  and size, the selection's class) come in the props, for its root.
-->
<script lang="ts">
  import { ImageSize } from "wordgard/types";

  import {
    type WidgetComponentProps,
    useIsNodeSelected,
    useNodePos,
    useStopEvent,
    useWordgard,
  } from "@stesura/svelte-wordgard";
  import type { FigureValue } from "./figureValue.js";

  const MIN_WIDTH = 50;

  // -1 for the handles that grow the image leftwards.
  const handles = [
    { name: "top-left", sign: -1 },
    { name: "top-right", sign: 1 },
    { name: "left", sign: -1 },
    { name: "right", sign: 1 },
    { name: "bottom-left", sign: -1 },
    { name: "bottom-right", sign: 1 },
  ];

  type Drag = {
    pointerId: number;
    startX: number;
    startWidth: number;
    sign: number;
    width: number;
  };

  let { value, class: className, ...rest }: WidgetComponentProps<FigureValue> = $props();
  const wg = useWordgard();
  const getPos = useNodePos();
  const selected = useIsNodeSelected();
  let figure = $state<HTMLElement | null>(null);
  let img = $state<HTMLImageElement | null>(null);
  let drag = $state.raw<Drag | null>(null);

  // Wordgard would start a selection or a node drag from the handles.
  useStopEvent(
    (_wg, event) => event.target instanceof Element && !!event.target.closest(".resize-handle")
  );

  const start = (sign: number, event: PointerEvent) => {
    const { currentTarget } = event;
    if (event.button != 0 || !img || !(currentTarget instanceof Element)) return;
    event.preventDefault();
    currentTarget.setPointerCapture(event.pointerId);
    const startWidth = img.getBoundingClientRect().width;
    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth,
      sign,
      width: startWidth,
    };
  };
  const move = (event: PointerEvent) => {
    if (!drag || event.pointerId != drag.pointerId) return;
    // The figure's container: the figure itself has the committed width.
    const max = figure?.parentElement?.clientWidth ?? Infinity;
    const next = drag.startWidth + drag.sign * (event.clientX - drag.startX);
    drag = { ...drag, width: Math.round(Math.min(max, Math.max(MIN_WIDTH, next))) };
  };
  const end = (keep: boolean, event: PointerEvent) => {
    const current = drag;
    if (!current || event.pointerId != current.pointerId) return;
    drag = null;
    if (keep && current.width != current.startWidth)
      wg.dispatch({
        changes: { from: getPos(), add: ImageSize.of(current.width) },
        userEvent: "image.resize",
      });
  };

  const width = $derived.by(() => {
    const shown = drag?.width ?? value.width;
    return shown == null ? undefined : `${shown}px`;
  });
</script>

<figure
  {...rest}
  bind:this={figure}
  class={[
    typeof className == "string" && className,
    "resizable",
    (selected.current || drag) && "active",
  ]}
>
  <span class="resize-frame">
    <img bind:this={img} src={value.src} alt={value.alt} draggable="false" style:width />
    {#each handles as { name, sign } (name)}
      <span
        class={["resize-handle", name]}
        aria-hidden="true"
        onpointerdown={(event) => start(sign, event)}
        onpointermove={move}
        onpointerup={(event) => end(true, event)}
        onpointercancel={(event) => end(false, event)}
      ></span>
    {/each}
    {#if drag}<span class="resize-label">{drag.width} px</span>{/if}
  </span>
</figure>
