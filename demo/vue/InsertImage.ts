// Adapted from react-wordgard's demo (demo/InsertImage.tsx) for Vue: a menu bar button opening a
// form that asks for an image's link and alt text, then inserts it as a block figure, after
// Wordgard's image dialog. The button only toggles a state field: the form is Vue's.
import { computed, defineComponent, shallowRef } from "vue";
import { Menu } from "wordgard/command";
import { ChangeSet, type Mark } from "wordgard/doc";
import { GardSelection, GardState, Transaction } from "wordgard/state";
import { Figure, ImageAlt } from "wordgard/types";

import { useEditorEffect, useEditorState, useWordgard } from "@stesura/vue-wordgard";
import { focus } from "./focus.js";

const setOpen = Transaction.Effect.define<boolean>();

// Closes on any explicit selection change, as Wordgard's dialogs do.
const formOpen = GardState.Field.define({
  create: () => false,
  update: (open, tr) => {
    for (const effect of tr.effects) if (effect.is(setOpen)) return effect.value;
    return tr.selection ? false : open;
  },
});

const description = "Insert an image";

const button = Menu.Button.define({
  run: (wg) => ({ effects: setOpen.of(!wg.state.field(formOpen)) }),
  active: (state) => state.field(formOpen),
  // Wordgard's image icon.
  label: {
    icon: "M38 34a9 9 0 1 1-19 0 9 9 0 0 1 19 0M9 13A9 9 0 0 0 0 22v56A9 9 0 0 0 9 88h81a9 9 0 0 0 9-9v-56A9 9 0 0 0 91 13zm81 6a3 3 0 0 1 3 3v38l-24-12a3 3 0 0 0-4 1l-23 23-17-11a3 3 0 0 0-4 0L6 75v3L6 78v-56a3 3 0 0 1 3-3z",
  },
  description,
  enable: (state) => !state.readOnly,
  parent: Menu.Group.insert,
});

export const insertImage = [formOpen, button];

export const InsertImage = defineComponent({
  directives: { focus },
  setup() {
    const wg = useWordgard();
    const state = useEditorState();
    const open = computed(() => state.value.field(formOpen, false) ?? false);
    const coords = shallowRef<{ left: number; top: number } | null>(null);

    // Under the menu button, read after the update that opened the form.
    useEditorEffect((wg) => {
      const anchor = open.value && wg.dom.querySelector(`[aria-label="${description}"]`);
      if (!anchor) {
        coords.value = null;
        return;
      }
      // The button ends the menu bar: the form hangs leftwards from it.
      const { right, bottom } = anchor.getBoundingClientRect();
      coords.value = { left: right + scrollX, top: bottom + scrollY + 4 };
    }, open);

    const close = () => {
      wg.dispatch({ effects: setOpen.of(false) });
      wg.focus();
    };

    const insert = (src: string, alt: string) => {
      const { sel } = wg.state;
      const marks: Mark.Set = alt ? ImageAlt.of(alt).addToSet([]) : [];
      const figure = Figure.of(src, marks);
      const change = { from: sel.from.pos, to: sel.to.pos, insert: [figure], fit: true };
      const pos = ChangeSet.create(wg.state.doc, change).findInserted((tag) => tag == figure);
      wg.dispatch({
        changes: change,
        effects: setOpen.of(false),
        userEvent: "insert.image",
        selection: pos == null ? undefined : GardSelection.node(pos, figure),
      });
      wg.focus();
    };

    const save = (event: SubmitEvent) => {
      if (!(event.currentTarget instanceof HTMLFormElement)) return;
      const data = new FormData(event.currentTarget);
      const src = String(data.get("src") ?? "").trim();
      if (src) insert(src, String(data.get("alt") ?? "").trim());
    };

    return { open, coords, description, close, save };
  },
  template: `
    <Teleport to="body">
      <form
        v-if="open && coords"
        class="image-form"
        :aria-label="description"
        :style="{ left: coords.left + 'px', top: coords.top + 'px' }"
        @submit.prevent="save"
        @keydown.esc="close"
      >
        <label>
          Link
          <input v-focus name="src" type="url" required placeholder="https://…" />
        </label>
        <label>
          <span>Alt text <small>(optional)</small></span>
          <input name="alt" />
        </label>
        <div>
          <button type="button" @click="close">Cancel</button>
          <button type="submit">Save</button>
        </div>
      </form>
    </Teleport>`,
});
