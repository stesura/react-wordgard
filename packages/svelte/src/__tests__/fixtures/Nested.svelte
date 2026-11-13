<script lang="ts">
  let { k, show = true }: { k: number; show?: boolean } = $props();
</script>

{#key k}{#if show}<p data-k={k}></p>{/if}{/key}
