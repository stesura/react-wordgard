<!--
  Adapted from react-wordgard's demo (demo/TextMenu.tsx, by way of vue-wordgard's) for Svelte: a
  floating formatting toolbar over a text selection, after Stesura's text menu, simplified: marks
  only, shown once the mouse is up.
-->
<script lang="ts">
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

  import { useEditorEventListener, useEditorState, useWordgard } from "@stesura/svelte-wordgard";
  import { portal } from "./portal.js";
  import { useFloatingAt } from "./useFloatingAt.svelte.js";

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

  const wg = useWordgard();
  const editorState = useEditorState();
  let focused = $state(false);
  let pointerDown = $state(false);
  useEditorEventListener("focus", () => {
    focused = true;
    return false;
  });
  useEditorEventListener("blur", () => {
    focused = false;
    return false;
  });
  // Not while a mouse selection is being made: the mouseup may land outside
  // the editor.
  useEditorEventListener("mousedown", () => {
    pointerDown = true;
    addEventListener("mouseup", () => (pointerDown = false), { once: true });
    return false;
  });

  const from = $derived.by(() => {
    const { selection } = editorState.current;
    return selection.empty || selection instanceof GardSelection.Node ? null : selection.from;
  });
  const open = $derived(focused && !pointerDown && from != null);
  const active = $derived(
    open ? buttons.map(({ mark }) => isActive(editorState.current, mark)) : []
  );
  const linked = $derived(open && hasLink(editorState.current));
  const coords = useFloatingAt(() => (open ? from : null));

  const toggle = (mark: Mark) => Command.dispatch(wg, toggleMark, mark);
  const toggleLink = () => Command.dispatch(wg, link.button.run);
</script>

<!-- The mousedown's default kept would take the editor's focus and selection. -->
{#if open && coords.current}
  <div
    {@attach portal}
    class="text-menu"
    role="toolbar"
    tabindex="-1"
    aria-label="Text formatting"
    style:left="{coords.current.left}px"
    style:top="{coords.current.top}px"
    onmousedown={(event) => event.preventDefault()}
  >
    {#each buttons as { label, title, mark }, i (title)}
      <button type="button" {title} aria-pressed={!!active[i]} onclick={() => toggle(mark)}>
        {label}
      </button>
    {/each}
    <button type="button" title="Link" aria-pressed={linked} onclick={toggleLink}>🔗</button>
  </div>
{/if}
