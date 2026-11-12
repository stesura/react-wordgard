<script lang="ts">
  import type { Attachment } from "svelte/attachments";

  let { attach }: { attach: Attachment<Element> } = $props();
</script>

<p {@attach attach}></p>
