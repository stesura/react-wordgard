<!-- Logs, as "heard", the keys of the editor's keydown events. -->
<script lang="ts">
  import { useEditorEventListener } from "../../../hooks/useEditorEventListener.js";
  import { log } from "./probes.js";

  useEditorEventListener("keydown", (_, event) => {
    log("heard", event.key);
  });
</script>
