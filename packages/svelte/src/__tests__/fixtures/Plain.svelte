<script lang="ts">
  let { n = 0, onclick }: { n?: number; onclick?: () => void } = $props();
</script>

<button {onclick}>{n}</button>
