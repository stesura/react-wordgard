<!-- A node wrapper handing what it wraps a lead, from its own state. -->
<script lang="ts">
  import { setContext } from "svelte";

  import WrappedNode from "../../components/WrappedNode.svelte";
  import type { NodeWrapperComponentProps } from "../../decorations/SvelteNodeWrapper.js";
  import { useWordgard } from "../../hooks/useWordgard.js";
  import { Lead, type LeadValue, initial, register } from "./controls.js";

  let { nodeProps }: NodeWrapperComponentProps = $props();
  let lead = $state(initial.lead);
  const value: LeadValue = {
    get current() {
      return lead;
    },
  };
  setContext(Lead, value);
  register(useWordgard(), {
    set: (name, next) => {
      if (name == "lead") lead = next == null ? null : String(next);
    },
    getPos: () => nodeProps.getPos(),
  });
</script>

<WrappedNode />
