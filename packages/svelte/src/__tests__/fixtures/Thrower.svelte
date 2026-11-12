<!-- A shape that throws while `initial.fail` is set, when drawn or on its own. -->
<script lang="ts">
  import type { ShapeComponentProps } from "../../decorations/SvelteShapeType.js";
  import { useWordgard } from "../../hooks/useWordgard.js";
  import { initial, register } from "./controls.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
  let broken = $state(false);
  const check = (node: unknown, fail: boolean) => {
    if (fail) throw new Error("Thrower");
    return node ? "ok" : "";
  };
  register(useWordgard(), {
    set: (name, value) => {
      if (name == "broken") broken = value == true;
    },
    getPos: () => nodeProps.getPos(),
  });
</script>

<div {...rest} data-state={check(nodeProps.node, initial.fail || broken)}>
  <div {@attach contentDOMRef}></div>
</div>
