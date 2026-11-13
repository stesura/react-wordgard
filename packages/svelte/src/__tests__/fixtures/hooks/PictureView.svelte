<!-- An image stopping every event, inside a widget, its node's selection as an attribute. -->
<script lang="ts">
  import { useIsNodeSelected } from "../../../hooks/useIsNodeSelected.js";
  import { useStopEvent } from "../../../hooks/useStopEvent.js";

  useStopEvent(() => true);
  const selected = useIsNodeSelected();
</script>

<img alt="" class="picture" data-selected={String(selected.current)} />
