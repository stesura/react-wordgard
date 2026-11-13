<script lang="ts">
  let { more }: { more: boolean } = $props();
</script>

<p>a</p>
{#if more}<i>b</i>{/if}
