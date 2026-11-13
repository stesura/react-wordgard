<!--
  Around an inline atom: a badge from its own state. It leaves out the attributes, contenteditable
  among them: the build makes it uneditable.
-->
<script lang="ts">
  import type { WrapperComponentProps } from "../../../decorations/SvelteWrapperType.js";
  import { useWordgard } from "../../../hooks/useWordgard.js";
  import { initial } from "../controls.js";
  import { enlist } from "./state.js";

  let { nodeProps, wrappedDOMRef }: WrapperComponentProps = $props();
  let badge = $state(initial.header);
  enlist(useWordgard(), "frame", {
    set: (name, value) => {
      if (name == "header") badge = value == true;
    },
    getPos: () => nodeProps.getPos(),
  });
</script>

<span {@attach wrappedDOMRef}
  >{#if badge}<i class="badge">*</i>{/if}</span
>
