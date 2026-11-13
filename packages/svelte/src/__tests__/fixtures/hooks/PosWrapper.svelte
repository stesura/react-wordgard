<!-- A node wrapper calling useNodePos: refused. -->
<script lang="ts">
  import WrappedNode from "../../../components/WrappedNode.svelte";
  import { useNodePos } from "../../../hooks/useNodePos.js";

  useNodePos();
</script>

<WrappedNode />
