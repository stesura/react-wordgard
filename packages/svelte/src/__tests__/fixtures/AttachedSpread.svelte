<script lang="ts">
  import type { Attachment } from "svelte/attachments";

  let { attach, ...rest }: { attach: Attachment<Element>; [attribute: string]: unknown } = $props();
</script>

<p {...rest} {@attach attach}></p>
