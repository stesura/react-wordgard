<!--
  Adapted from react-wordgard's demo (demo/decorations/Callout.tsx, by way of vue-wordgard's) for
  Svelte: the callout's icon, a menu of kinds.
-->
<script lang="ts">
  import { type CalloutKindName, calloutKinds, isCalloutKind } from "../../schema.js";

  let { kind, onpick }: { kind: CalloutKindName; onpick: (kind: CalloutKindName) => void } =
    $props();
  let open = $state(false);
  const kindNames = Object.keys(calloutKinds).filter(isCalloutKind);

  const leave = (event: FocusEvent) => {
    const { currentTarget, relatedTarget } = event;
    if (!(currentTarget instanceof Node && relatedTarget instanceof Node)) open = false;
    else if (!currentTarget.contains(relatedTarget)) open = false;
  };
</script>

<span class="callout-kind" onfocusout={leave}>
  <button
    type="button"
    aria-label="Callout kind"
    aria-expanded={open}
    onclick={() => (open = !open)}
  >
    {calloutKinds[kind].icon}
  </button>
  {#if open}
    <span class="popover" role="menu">
      {#each kindNames as name (name)}
        <button
          type="button"
          role="menuitemradio"
          aria-checked={name == kind}
          onclick={() => {
            open = false;
            onpick(name);
          }}
        >
          {calloutKinds[name].icon}
          {calloutKinds[name].label}
        </button>
      {/each}
    </span>
  {/if}
</span>
