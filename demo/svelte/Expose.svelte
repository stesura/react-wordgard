<!-- The editor, for the console. -->
<script lang="ts">
  import { useEditorEffect } from "@stesura/svelte-wordgard";

  useEditorEffect((wg) => {
    Object.assign(window, { wg });
  });
</script>
