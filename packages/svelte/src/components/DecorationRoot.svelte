<!--
  Adapted from react-wordgard's DecorationRoot (by way of vue-wordgard's) for Svelte: the
  decoration's root element, of the tag it says (a heading's level, per node). Wordgard's attributes
  come in the props spread on it. Given `content` (a shape's or mark's contentDOMRef), it is also the
  content element, its children the content: it draws nothing else then. Svelte puts a comment beside
  it and an empty text node in it: the comment stays out of the document (helpers/mountRoot.ts), the
  text node is removed when the content goes in (helpers/slot.ts).
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Attachment } from "svelte/attachments";

  import { localTagName } from "@stesura/wordgard-view";
  import { useDecorationContext } from "../contexts/DecorationContext.js";

  type Props = {
    content?: Attachment<Element>;
    children?: Snippet;
    [attribute: string]: unknown;
  };

  let { content, children, ...rest }: Props = $props();
  const decoration = useDecorationContext("DecorationRoot");
  const tag = $derived(localTagName(decoration.tagName.current));
</script>

{#if content}
  <svelte:element this={tag} {...rest} {@attach content}></svelte:element>
{:else}
  <svelte:element this={tag} {...rest}>{@render children?.()}</svelte:element>
{/if}
