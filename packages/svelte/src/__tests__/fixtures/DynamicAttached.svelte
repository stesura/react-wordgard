<script lang="ts">
  import type { Attachment } from "svelte/attachments";

  let { tag, attach }: { tag: string; attach: Attachment<Element> } = $props();
</script>

<svelte:element this={tag} {@attach attach}></svelte:element>
