<!-- Hands the test the editor it's drawn under. -->
<script lang="ts">
  import { useWordgard } from "../../../hooks/useWordgard.js";
  import { grabbed } from "./probes.js";

  grabbed.push(useWordgard());
</script>
