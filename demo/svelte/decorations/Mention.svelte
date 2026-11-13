<!--
  Adapted from react-wordgard's demo (demo/decorations/Mention.tsx, by way of vue-wordgard's) for
  Svelte: a mention, an inline node drawn by a Svelte widget, which shows a card for the person
  while it's selected (click it, or move onto it). The node's attributes come in the props.
-->
<script lang="ts">
  import { people } from "../../schema.js";
  import { type WidgetComponentProps, useIsNodeSelected } from "@stesura/svelte-wordgard";

  let { value, ...rest }: WidgetComponentProps<string> = $props();
  const selected = useIsNodeSelected();
  const person = $derived(people[value]);
</script>

<span {...rest} class="mention"
  >@{person?.name ?? value}{#if selected.current && person}<span
      class="mention-card"
      aria-hidden="true"><strong>{person.name}</strong><span>{person.role}</span></span
    >{/if}</span
>
