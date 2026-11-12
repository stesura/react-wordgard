// Adapted from react-wordgard's demo (demo/decorations/Link.tsx) for Vue: a link drawn by Vue,
// hovering it shows a card with its target, chrome beside the marked text. DecorationRoot draws the
// root: it leaves out the comment the card's `v-if` would put among the mark's elements.
import { computed, defineComponent, ref } from "vue";

import {
  DecorationRoot,
  type MarkComponentProps,
  NodeContent,
  createMarkShape,
  useStopEvent,
} from "../../src/index.js";

const LinkView = defineComponent({
  props: ["markProps"],
  components: { DecorationRoot, NodeContent },
  setup(props: MarkComponentProps) {
    const hover = ref(false);
    const href = computed(() => String(props.markProps.mark.value));
    const host = computed(() => new URL(href.value, location.href).host);
    useStopEvent(
      (_wg, event) => event.target instanceof Element && !!event.target.closest(".link-card")
    );
    const open = () => window.open(href.value, "_blank", "noopener");
    return { hover, href, host, open };
  },
  template: `
    <DecorationRoot :href="href" @mouseenter="hover = true" @mouseleave="hover = false">
      <NodeContent as="span" />
      <span v-if="hover" class="link-card">
        <span>{{ host }}</span>
        <button type="button" @click="open">Open</button>
      </span>
    </DecorationRoot>`,
});

export const LinkShape = createMarkShape(LinkView, { element: "a" });
