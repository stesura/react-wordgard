<!-- Calls `ready` once the editor is drawn. -->
<script lang="ts">
  import type { Wordgard } from "wordgard/editor";

  import { useEditorEffect } from "@stesura/svelte-wordgard";

  let { ready }: { ready: (wg: Wordgard) => void } = $props();
  useEditorEffect((wg) => ready(wg));
</script>
