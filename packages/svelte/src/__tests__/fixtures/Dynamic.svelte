<script lang="ts">
  let { tag, n }: { tag: string; n: number } = $props();
</script>

<svelte:element this={tag} data-n={n}></svelte:element>
