<script lang="ts">
  import type { Attachment } from "svelte/attachments";

  let { show, attach }: { show: boolean; attach: Attachment<Element> } = $props();
</script>

{#if show}<p {@attach attach}></p>{/if}
