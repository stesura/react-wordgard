<!--
  A shape, wrapper, mark or widget (by its props) whose root is replaced from its own state: a
  {#key} at its top.
-->
<script lang="ts">
  import type { Attachment } from "svelte/attachments";

  import { useWordgard } from "../../hooks/useWordgard.js";
  import { initial, register } from "./controls.js";

  type Props = {
    nodeProps?: unknown;
    markProps?: { mark: { value: unknown } };
    contentDOMRef?: Attachment<Element>;
    wrappedDOMRef?: Attachment<Element>;
    value?: unknown;
    [attribute: string]: unknown;
  };

  let { nodeProps, markProps, contentDOMRef, wrappedDOMRef, value, ...rest }: Props = $props();
  let key = $state(initial.key);
  register(useWordgard(), {
    set: (name, next) => {
      if (name == "key") key = Number(next);
    },
    getPos: () => 0,
  });
</script>

{#if wrappedDOMRef}
  {#key key}<section {...rest} data-key={key} {@attach wrappedDOMRef}></section>{/key}
{:else if markProps && contentDOMRef}
  {#key key}<a {...rest} href={String(markProps.mark.value)} data-key={key}
      ><span class="text" {@attach contentDOMRef}></span></a
    >{/key}
{:else if nodeProps && contentDOMRef}
  {#key key}<div {...rest} data-key={key}>
      <div class="body" {@attach contentDOMRef}></div>
    </div>{/key}
{:else}
  {#key key}<i {...rest} class="badge" data-key={key} data-value={String(value)}></i>{/key}
{/if}
