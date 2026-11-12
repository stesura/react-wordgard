// Adapted from react-wordgard's demo (demo/decorations/Callout.tsx) for Vue: a callout after
// Stesura's, a title bar of chrome above the content. The icon picks the kind, a double-click on
// the title edits it.
import { computed, defineComponent, ref } from "vue";

import {
  CalloutKind,
  type CalloutKindName,
  CalloutTitle,
  calloutKinds,
  isCalloutKind,
} from "../../schema.js";
import {
  DecorationRoot,
  NodeContent,
  type ShapeComponentProps,
  createShape,
  useNodePos,
  useStopEvent,
  useWordgard,
} from "@stesura/vue-wordgard";
import { focus } from "../focus.js";

const kindNames = Object.keys(calloutKinds).filter(isCalloutKind);

const KindPicker = defineComponent({
  props: ["kind"],
  emits: ["pick"],
  setup() {
    const open = ref(false);
    const leave = (event: FocusEvent) => {
      const { currentTarget, relatedTarget } = event;
      if (!(currentTarget instanceof Node && relatedTarget instanceof Node)) open.value = false;
      else if (!currentTarget.contains(relatedTarget)) open.value = false;
    };
    return { open, leave, kinds: calloutKinds, kindNames };
  },
  template: `
    <span class="callout-kind" @focusout="leave">
      <button type="button" aria-label="Callout kind" :aria-expanded="open" @click="open = !open">
        {{ kinds[kind].icon }}
      </button>
      <span v-if="open" class="popover" role="menu">
        <button
          v-for="name in kindNames"
          :key="name"
          type="button"
          role="menuitemradio"
          :aria-checked="name == kind"
          @click="open = false; $emit('pick', name)"
        >
          {{ kinds[name].icon }} {{ kinds[name].label }}
        </button>
      </span>
    </span>`,
});

// Enter and blur commit, Escape cancels. `v-model` comes before `v-focus`: it
// sets the value in its own `mounted`, which would drop the selection.
const TitleField = defineComponent({
  props: ["title", "placeholder"],
  emits: ["finish"],
  directives: { focus },
  setup(props, { emit }) {
    const draft = ref(String(props.title ?? ""));
    // Enter and Escape finish before the blur that unmounting causes.
    let finished = false;
    const finish = (value: string | null, refocus: boolean) => {
      if (finished) return;
      finished = true;
      emit("finish", value?.trim() ?? null, refocus);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key != "Enter" && event.key != "Escape") return;
      event.preventDefault();
      finish(event.key == "Enter" ? draft.value : null, true);
    };
    const select = (event: FocusEvent) => {
      if (event.target instanceof HTMLInputElement) event.target.select();
    };
    return { draft, finish, key, select };
  },
  template: `
    <input
      v-model="draft"
      v-focus
      aria-label="Callout title"
      :placeholder="placeholder"
      @focus="select"
      @blur="finish(draft, false)"
      @keydown="key"
    />`,
});

const Title = defineComponent({
  props: ["title", "placeholder"],
  emits: ["finish"],
  components: { TitleField },
  setup(_, { emit }) {
    const editing = ref(false);
    const done = (draft: string | null, refocus: boolean) => {
      editing.value = false;
      emit("finish", draft, refocus);
    };
    return { editing, done };
  },
  template: `
    <TitleField v-if="editing" :title="title" :placeholder="placeholder" @finish="done" />
    <span v-else title="Double-click to rename" @dblclick="editing = true">
      {{ title ?? placeholder }}
    </span>`,
});

// Drawn with DecorationRoot: the callout type's own <aside class="callout">.
export const CalloutShape = createShape(
  defineComponent({
    props: ["nodeProps"],
    components: { DecorationRoot, NodeContent, KindPicker, Title },
    setup(props: ShapeComponentProps) {
      const wg = useWordgard();
      const getPos = useNodePos();
      const kind = computed(() => props.nodeProps.node.tag.mark(CalloutKind) ?? "note");
      const title = computed(() => props.nodeProps.node.tag.mark(CalloutTitle));

      // The bar's events are its controls', not the editor's.
      const bar = ref<HTMLElement | null>(null);
      useStopEvent(
        (_wg, event) => event.target instanceof Node && !!bar.value?.contains(event.target)
      );

      const setKind = (next: CalloutKindName) => {
        wg.dispatch({ changes: { from: getPos(), add: CalloutKind.of(next) } });
        wg.focus();
      };
      // `null` cancels; a blur doesn't pull the focus back from where it went.
      const finishTitle = (next: string | null, refocus: boolean) => {
        const from = getPos();
        if (next && next != title.value)
          wg.dispatch({ changes: { from, add: CalloutTitle.of(next) } });
        else if (next == "" && title.value)
          wg.dispatch({ changes: { from, remove: CalloutTitle.of(title.value) } });
        if (refocus) wg.focus();
      };
      return { kind, title, bar, setKind, finishTitle, kinds: calloutKinds };
    },
    template: `
      <DecorationRoot :data-kind="kind">
        <div ref="bar" class="callout-title">
          <KindPicker :kind="kind" @pick="setKind" />
          <Title :title="title" :placeholder="kinds[kind].label" @finish="finishTitle" />
        </div>
        <NodeContent as="div" class="callout-body" />
      </DecorationRoot>`,
  })
);
