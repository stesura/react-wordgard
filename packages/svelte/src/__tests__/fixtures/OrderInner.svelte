<!-- A node wrapper giving the node a class array and an order, the inner one. -->
<script lang="ts">
  import WrappedNode from "../../components/WrappedNode.svelte";
</script>

<WrappedNode class={["inner", false, { kept: true, dropped: false }]} data-order="inner" />
