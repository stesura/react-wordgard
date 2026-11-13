<script lang="ts">
  import type { Attachment } from "svelte/attachments";

  let { attach, n = 0 }: { attach: Attachment<Element>; n?: number } = $props();
</script>

<p data-n={n} {@attach attach}></p>
