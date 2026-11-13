<script lang="ts">
  let { n, log }: { n: number; log: (what: string) => void } = $props();
  $effect.pre(() => log(`pre ${n}`));
  $effect(() => log(`effect ${n}`));
</script>

<p>{n}</p>
