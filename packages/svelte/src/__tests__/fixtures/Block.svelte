<script lang="ts">
  let { show }: { show: boolean } = $props();
</script>

{#if show}<p>a</p>{:else}<div>b</div>{/if}
