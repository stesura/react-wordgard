<!-- Writes, as "writes", the paragraph count, only when it changed since the last write. -->
<script lang="ts">
  import { useEditorLayoutEffect } from "../../../hooks/useEditorLayoutEffect.js";
  import { log } from "./probes.js";

  let last = -1;
  useEditorLayoutEffect({
    read: (wg) => {
      const count = wg.contentDOM.children.length;
      return count == last ? undefined : count;
    },
    write: (count) => {
      last = count;
      log("writes", count);
    },
  });
</script>
