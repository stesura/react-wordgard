// Adapted from react-wordgard's demo (demo/MentionMenu.tsx) for Vue: suggestions for a mention.
// Typing `@` and a name lists the matching people; arrows move, Enter or a click inserts, Escape
// dismisses.
import { computed, defineComponent, ref } from "vue";
import { Leaf, Slice } from "wordgard/doc";
import type { GardState } from "wordgard/state";

import { Mention, people } from "../../demo/schema.js";
import { useEditorEventListener, useEditorState, useWordgard } from "../src/index.js";
import { useFloatingAt } from "./useFloatingAt.js";

// Where the `@` is and what follows it, as "from:query", compared by value.
const trigger = (state: GardState) => {
  if (!state.selection.isCursor) return null;
  const { head } = state.sel;
  const textblock = head.textblockParent;
  if (!textblock || !state.schema.has(Mention)) return null;
  const before = Slice.get(state.doc, textblock.start, head.pos).textContent({ leafText: " " });
  const query = /(?:^|\s)@(\w*)$/.exec(before)?.[1];
  return query == null ? null : `${head.pos - query.length - 1}:${query}`;
};

export const MentionMenu = defineComponent({
  setup() {
    const wg = useWordgard();
    const state = useEditorState();
    const found = computed(() => trigger(state.value));
    const dismissed = ref<string | null>(null);
    const index = ref(0);

    const at = computed(() => (found.value ? Number(found.value.split(":")[0]) : null));
    const matches = computed(() => {
      if (!found.value) return [];
      const query = found.value.slice(found.value.indexOf(":") + 1).toLowerCase();
      return Object.entries(people).filter(([, { name }]) => name.toLowerCase().includes(query));
    });
    const open = computed(
      () => found.value != null && found.value != dismissed.value && matches.value.length > 0
    );
    const selected = computed(() => Math.min(index.value, matches.value.length - 1));
    const coords = useFloatingAt(computed(() => (open.value ? at.value : null)));

    const insert = (id: string) => {
      if (at.value == null) return;
      wg.dispatch({
        changes: {
          from: at.value,
          to: wg.state.selection.from,
          insert: [Mention.of(id), Leaf.Text.of(" ")],
        },
        userEvent: "input.mention",
      });
      index.value = 0;
      wg.focus();
    };

    useEditorEventListener("keydown", (_wg, event) => {
      if (!open.value) return false;
      const count = matches.value.length;
      if (event.key == "ArrowDown" || event.key == "ArrowUp") {
        const step = event.key == "ArrowDown" ? 1 : -1;
        index.value = (selected.value + step + count) % count;
      } else if (event.key == "Enter" || event.key == "Tab") {
        const [id] = matches.value[selected.value] ?? [];
        if (id) insert(id);
      } else if (event.key == "Escape") {
        dismissed.value = found.value;
      } else {
        return false;
      }
      return true;
    });

    return { open, coords, matches, selected, insert };
  },
  template: `
    <Teleport to="body">
      <ul
        v-if="open && coords"
        class="mention-menu"
        role="listbox"
        aria-label="People"
        :style="{ left: coords.left + 'px', top: coords.bottom + 'px' }"
        @mousedown.prevent
      >
        <li
          v-for="([id, { name, role }], i) in matches"
          :key="id"
          role="option"
          :aria-selected="i == selected"
          @click="insert(id)"
        >
          <strong>{{ name }}</strong> <span>{{ role }}</span>
        </li>
      </ul>
    </Teleport>`,
});
