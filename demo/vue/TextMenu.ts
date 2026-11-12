// Adapted from react-wordgard's demo (demo/TextMenu.tsx) for Vue: a floating formatting toolbar
// over a text selection, after Stesura's text menu, simplified: marks only, shown once the mouse
// is up.
import { computed, defineComponent, ref } from "vue";
import { Command, canAddMarkInRange, toggleMark } from "wordgard/command";
import type { Mark } from "wordgard/doc";
import { link } from "wordgard/schema";
import { GardSelection, type GardState } from "wordgard/state";
import {
  BackgroundColor,
  Code,
  Emphasis,
  Link,
  Strikethrough,
  Strong,
  Underline,
} from "wordgard/types";

import { useEditorEventListener, useEditorState, useWordgard } from "@stesura/vue-wordgard";
import { useFloatingAt } from "./useFloatingAt.js";

const buttons: { label: string; title: string; mark: Mark }[] = [
  { label: "B", title: "Bold", mark: Strong },
  { label: "I", title: "Italic", mark: Emphasis },
  { label: "U", title: "Underline", mark: Underline },
  { label: "S", title: "Strikethrough", mark: Strikethrough },
  { label: "</>", title: "Code", mark: Code },
  { label: "H", title: "Highlight", mark: BackgroundColor.of("#fde68a") },
];

// As Wordgard's mark buttons: active when no selected text could take it.
const isActive = (state: GardState, mark: Mark) =>
  !state.selection.ranges.some((r) => canAddMarkInRange(state.doc, r.from, r.to, mark));

const hasLink = (state: GardState) => {
  let found = false;
  for (const { from, to } of state.selection.ranges)
    state.doc.iterate(from, to, (node) => {
      if (Link.isInSet(node.marks)) found = true;
      return !found;
    });
  return found;
};

export const TextMenu = defineComponent({
  setup() {
    const wg = useWordgard();
    const state = useEditorState();
    const focused = ref(false);
    const pointerDown = ref(false);
    useEditorEventListener("focus", () => {
      focused.value = true;
      return false;
    });
    useEditorEventListener("blur", () => {
      focused.value = false;
      return false;
    });
    // Not while a mouse selection is being made: the mouseup may land outside
    // the editor.
    useEditorEventListener("mousedown", () => {
      pointerDown.value = true;
      addEventListener("mouseup", () => (pointerDown.value = false), { once: true });
      return false;
    });

    const from = computed(() => {
      const { selection } = state.value;
      return selection.empty || selection instanceof GardSelection.Node ? null : selection.from;
    });
    const open = computed(() => focused.value && !pointerDown.value && from.value != null);
    const active = computed(() =>
      open.value ? buttons.map(({ mark }) => isActive(state.value, mark)) : []
    );
    const linked = computed(() => open.value && hasLink(state.value));
    const coords = useFloatingAt(computed(() => (open.value ? from.value : null)));

    const toggle = (mark: Mark) => Command.dispatch(wg, toggleMark, mark);
    const toggleLink = () => Command.dispatch(wg, link.button.run);
    return { buttons, open, active, linked, coords, toggle, toggleLink };
  },
  // The mousedown's default kept would take the editor's focus and selection.
  template: `
    <Teleport to="body">
      <div
        v-if="open && coords"
        class="text-menu"
        role="toolbar"
        aria-label="Text formatting"
        :style="{ left: coords.left + 'px', top: coords.top + 'px' }"
        @mousedown.prevent
      >
        <button
          v-for="({ label, title, mark }, i) in buttons"
          :key="title"
          type="button"
          :title="title"
          :aria-pressed="!!active[i]"
          @click="toggle(mark)"
        >
          {{ label }}
        </button>
        <button type="button" title="Link" :aria-pressed="linked" @click="toggleLink">🔗</button>
      </div>
    </Teleport>`,
});
