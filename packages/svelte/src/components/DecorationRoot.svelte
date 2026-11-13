<!--
  Adapted from react-wordgard's DecorationRoot (by way of vue-wordgard's) for Svelte: the
  decoration's root element, of the tag it says (a heading's level, per node). Wordgard's attributes
  come in the props spread on it. Given `content` (a shape's or mark's contentDOMRef), it is also the
  content element, its children the content: it draws nothing else then, and keeps `content` for
  its life (its children's anchors go when it holds the content). One `<svelte:element>`, no block
  around it, so its tag changes without another root. Its root is still in nested blocks (the
  component's, under HMR), whose old root Svelte leaves in the document when it replaces it:
  `trackRoot` tells the holder (helpers/mountRoot.ts) that one is dead. Svelte puts a comment beside
  it, which stays in the holder, and anchors in it, which go when the content goes in (ShapeView's
  drawContent).
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Attachment } from "svelte/attachments";

  import { localTagName } from "@stesura/wordgard-view";
  import { useDecorationContext } from "../contexts/DecorationContext.js";
  import { trackRoot } from "../helpers/mountRoot.js";

  type Props = {
    content?: Attachment<Element>;
    children?: Snippet;
    [attribute: string]: unknown;
  };

  let { content, children, ...rest }: Props = $props();
  const decoration = useDecorationContext("DecorationRoot");
  const tag = $derived(localTagName(decoration.tagName.current));
  const none: Attachment<Element> = () => {};
</script>

<svelte:element this={tag} {...rest} {@attach content ?? none} {@attach trackRoot}
  >{@render children?.()}</svelte:element
>
