<!-- Adds a letter after the lead of the wrappers around it, to show their order. -->
<script lang="ts">
  import { setContext } from "svelte";

  import WrappedNode from "../../components/WrappedNode.svelte";
  import { Lead, type LeadValue, useLead } from "./controls.js";

  let { name }: { name: string } = $props();
  const outer = useLead();
  const value: LeadValue = {
    get current() {
      return `${outer.current ?? ""}${name}`;
    },
  };
  setContext(Lead, value);
</script>

<WrappedNode />
