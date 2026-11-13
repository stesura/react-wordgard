<!--
  Adapted from react-wordgard's demo (demo/InsertImage.tsx, by way of vue-wordgard's) for Svelte: a
  form asking for an image's link and alt text, which inserts it as a block figure, after
  Wordgard's image dialog.
-->
<script lang="ts">
  import { ChangeSet, type Mark } from "wordgard/doc";
  import { GardSelection } from "wordgard/state";
  import { Figure, ImageAlt } from "wordgard/types";

  import { useEditorEffect, useEditorState, useWordgard } from "@stesura/svelte-wordgard";
  import { description, formOpen, setOpen } from "./insertImage.js";
  import { portal } from "./portal.js";

  const wg = useWordgard();
  const editorState = useEditorState();
  const open = $derived(editorState.current.field(formOpen, false) ?? false);
  let coords = $state.raw<{ left: number; top: number } | null>(null);

  // Under the menu button, read after the update that opened the form.
  useEditorEffect(
    (wg) => {
      const anchor = open && wg.dom.querySelector(`[aria-label="${description}"]`);
      if (!anchor) {
        coords = null;
        return;
      }
      // The button ends the menu bar: the form hangs leftwards from it.
      const { right, bottom } = anchor.getBoundingClientRect();
      coords = { left: right + scrollX, top: bottom + scrollY + 4 };
    },
    () => open
  );

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
    event.preventDefault();
    if (!(event.currentTarget instanceof HTMLFormElement)) return;
    const data = new FormData(event.currentTarget);
    const src = String(data.get("src") ?? "").trim();
    if (src) insert(src, String(data.get("alt") ?? "").trim());
  };

  const escape = (event: KeyboardEvent) => {
    if (event.key == "Escape") close();
  };

  const focus = (element: HTMLElement) => element.focus();
</script>

{#if open && coords}
  <form
    {@attach portal}
    class="image-form"
    aria-label={description}
    style:left="{coords.left}px"
    style:top="{coords.top}px"
    onsubmit={save}
  >
    <label>
      Link
      <input
        {@attach focus}
        name="src"
        type="url"
        required
        placeholder="https://…"
        onkeydown={escape}
      />
    </label>
    <label>
      <span>Alt text <small>(optional)</small></span>
      <input name="alt" onkeydown={escape} />
    </label>
    <div>
      <button type="button" onclick={close}>Cancel</button>
      <button type="submit">Save</button>
    </div>
  </form>
{/if}
