// Adapted from react-wordgard's demo (demo/decorations/Figure.tsx) for Vue: a block image resized
// by dragging its handles, after Stesura's ImageResizeFrame, simplified: width only (Wordgard's
// ImageSize mark), the image itself previews the drag, and the size commits once, on release.
import { computed, defineComponent, ref, shallowRef } from "vue";
import { ImageSize } from "wordgard/types";

import {
  createWidgetType,
  useIsNodeSelected,
  useNodePos,
  useStopEvent,
  useWordgard,
} from "../../src/index.js";

export type FigureValue = { src: string; alt: string | undefined; width: number | undefined };

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

type Drag = { pointerId: number; startX: number; startWidth: number; sign: number; width: number };

// The node's attributes (its alt and size, the selection's class) fall
// through to the figure.
const FigureView = defineComponent({
  props: ["value"],
  setup(props: { value: FigureValue }) {
    const wg = useWordgard();
    const getPos = useNodePos();
    const selected = useIsNodeSelected();
    const figure = ref<HTMLElement | null>(null);
    const img = ref<HTMLImageElement | null>(null);
    const drag = shallowRef<Drag | null>(null);

    // Wordgard would start a selection or a node drag from the handles.
    useStopEvent(
      (_wg, event) => event.target instanceof Element && !!event.target.closest(".resize-handle")
    );

    const start = (sign: number, event: PointerEvent) => {
      const { currentTarget } = event;
      if (event.button != 0 || !img.value || !(currentTarget instanceof Element)) return;
      event.preventDefault();
      currentTarget.setPointerCapture(event.pointerId);
      const startWidth = img.value.getBoundingClientRect().width;
      drag.value = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth,
        sign,
        width: startWidth,
      };
    };
    const move = (event: PointerEvent) => {
      const current = drag.value;
      if (!current || event.pointerId != current.pointerId) return;
      // The figure's container: the figure itself has the committed width.
      const max = figure.value?.parentElement?.clientWidth ?? Infinity;
      const next = current.startWidth + current.sign * (event.clientX - current.startX);
      drag.value = { ...current, width: Math.round(Math.min(max, Math.max(MIN_WIDTH, next))) };
    };
    const end = (keep: boolean, event: PointerEvent) => {
      const current = drag.value;
      if (!current || event.pointerId != current.pointerId) return;
      drag.value = null;
      if (keep && current.width != current.startWidth)
        wg.dispatch({
          changes: { from: getPos(), add: ImageSize.of(current.width) },
          userEvent: "image.resize",
        });
    };

    const width = computed(() => {
      const shown = drag.value?.width ?? props.value.width;
      return shown == null ? undefined : `${shown}px`;
    });
    return { figure, img, drag, selected, handles, start, move, end, width };
  },
  template: `
    <figure ref="figure" :class="['resizable', { active: selected || drag }]">
      <span class="resize-frame">
        <img ref="img" :src="value.src" :alt="value.alt" draggable="false" :style="{ width }" />
        <span
          v-for="{ name, sign } in handles"
          :key="name"
          :class="['resize-handle', name]"
          aria-hidden="true"
          @pointerdown="start(sign, $event)"
          @pointermove="move"
          @pointerup="end(true, $event)"
          @pointercancel="end(false, $event)"
        />
        <span v-if="drag" class="resize-label">{{ drag.width }} px</span>
      </span>
    </figure>`,
});

export const ResizableFigure = createWidgetType<FigureValue>({
  eq: (a, b) => a.src == b.src && a.alt == b.alt && a.width == b.width,
  component: FigureView,
});
