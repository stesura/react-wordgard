<!--
  Adapted from react-wordgard's demo (demo/decorations/Callout.tsx, by way of vue-wordgard's) for
  Svelte: the callout's title, edited on a double-click. Enter and blur commit, Escape cancels.
-->
<script lang="ts">
  let {
    title,
    placeholder,
    onfinish,
  }: {
    title: string | undefined;
    placeholder: string;
    onfinish: (title: string | null, refocus: boolean) => void;
  } = $props();
  let editing = $state(false);
  let draft = $state("");
  // Enter and Escape finish before the blur that unmounting causes.
  let finished = false;

  const edit = () => {
    draft = title ?? "";
    finished = false;
    editing = true;
  };
  const finish = (value: string | null, refocus: boolean) => {
    if (finished) return;
    finished = true;
    editing = false;
    onfinish(value?.trim() ?? null, refocus);
  };
  const key = (event: KeyboardEvent) => {
    if (event.key != "Enter" && event.key != "Escape") return;
    event.preventDefault();
    finish(event.key == "Enter" ? draft : null, true);
  };
  const select = (input: HTMLInputElement) => {
    input.focus();
    input.select();
  };
</script>

{#if editing}
  <input
    bind:value={draft}
    {@attach select}
    aria-label="Callout title"
    {placeholder}
    onblur={() => finish(draft, false)}
    onkeydown={key}
  />
{:else}
  <span title="Double-click to rename" ondblclick={edit} role="heading" aria-level={3}>
    {title ?? placeholder}
  </span>
{/if}
