// Adapted from react-wordgard's demo (demo/InsertImage.tsx, by way of vue-wordgard's) for Svelte:
// the menu bar button opening InsertImage.svelte's form. It only toggles a state field: the form is
// Svelte's.
import { Menu } from "wordgard/command";
import { GardState, Transaction } from "wordgard/state";

export const setOpen = Transaction.Effect.define<boolean>();

// Closes on any explicit selection change, as Wordgard's dialogs do.
export const formOpen = GardState.Field.define({
  create: () => false,
  update: (open, tr) => {
    for (const effect of tr.effects) if (effect.is(setOpen)) return effect.value;
    return tr.selection ? false : open;
  },
});

export const description = "Insert an image";

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
