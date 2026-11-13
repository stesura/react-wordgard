<!--
  Adapted from react-wordgard's demo (demo/MentionMenu.tsx, by way of vue-wordgard's) for Svelte:
  suggestions for a mention. Typing `@` and a name lists the matching people; arrows move, Enter or
  a click inserts, Escape dismisses.
-->
<script lang="ts">
  import { Leaf, Slice } from "wordgard/doc";
  import type { GardState } from "wordgard/state";

  import { Mention, people } from "../schema.js";
  import { useEditorEventListener, useEditorState, useWordgard } from "@stesura/svelte-wordgard";
  import { portal } from "./portal.js";
  import { useFloatingAt } from "./useFloatingAt.svelte.js";

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

  const wg = useWordgard();
  const editorState = useEditorState();
  const found = $derived(trigger(editorState.current));
  let dismissed = $state<string | null>(null);
  let index = $state(0);

  const at = $derived(found ? Number(found.split(":")[0]) : null);
  const matches = $derived.by(() => {
    if (!found) return [];
    const query = found.slice(found.indexOf(":") + 1).toLowerCase();
    return Object.entries(people).filter(([, { name }]) => name.toLowerCase().includes(query));
  });
  const open = $derived(found != null && found != dismissed && matches.length > 0);
  const selected = $derived(Math.min(index, matches.length - 1));
  const coords = useFloatingAt(() => (open ? at : null));

  const insert = (id: string) => {
    if (at == null) return;
    wg.dispatch({
      changes: {
        from: at,
        to: wg.state.selection.from,
        insert: [Mention.of(id), Leaf.Text.of(" ")],
      },
      userEvent: "input.mention",
    });
    index = 0;
    wg.focus();
  };

  useEditorEventListener("keydown", (_wg, event) => {
    if (!open) return false;
    const count = matches.length;
    if (event.key == "ArrowDown" || event.key == "ArrowUp") {
      const step = event.key == "ArrowDown" ? 1 : -1;
      index = (selected + step + count) % count;
    } else if (event.key == "Enter" || event.key == "Tab") {
      const [id] = matches[selected] ?? [];
      if (id) insert(id);
    } else if (event.key == "Escape") {
      dismissed = found;
    } else {
      return false;
    }
    return true;
  });
</script>

<!-- The mousedown's default kept would take the editor's focus and selection. -->
{#if open && coords.current}
  <ul
    {@attach portal}
    class="mention-menu"
    role="listbox"
    aria-label="People"
    style:left="{coords.current.left}px"
    style:top="{coords.current.bottom}px"
    onmousedown={(event) => event.preventDefault()}
  >
    {#each matches as [id, { name, role }], i (id)}
      <!-- Its keys are the editor's (the keydown listener above). -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <li role="option" aria-selected={i == selected} onclick={() => insert(id)}>
        <strong>{name}</strong> <span>{role}</span>
      </li>
    {/each}
  </ul>
{/if}
