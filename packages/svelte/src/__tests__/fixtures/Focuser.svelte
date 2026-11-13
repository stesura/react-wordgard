<!-- Outside the document: focuses the editor from an effect once `on` says so. -->
<script lang="ts">
  import type { Wordgard } from "wordgard/editor";

  let { wg, on }: { wg: Wordgard; on: { readonly current: boolean } } = $props();
  $effect(() => {
    if (on.current) wg.focus();
  });
</script>
