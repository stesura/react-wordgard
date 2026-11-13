<!-- A shape, wrapper or mark (by its props) whose root, drawn by DecorationRoot, holds the content. -->
<script lang="ts">
  import type { Attachment } from "svelte/attachments";

  import DecorationRoot from "../../../components/DecorationRoot.svelte";

  type Props = {
    nodeProps?: unknown;
    markProps?: unknown;
    contentDOMRef?: Attachment<Element>;
    wrappedDOMRef?: Attachment<Element>;
    [attribute: string]: unknown;
  };

  let { nodeProps, markProps, contentDOMRef, wrappedDOMRef, ...rest }: Props = $props();
</script>

<DecorationRoot {...rest} content={contentDOMRef ?? wrappedDOMRef} />
