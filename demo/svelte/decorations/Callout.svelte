<!--
  Adapted from react-wordgard's demo (demo/decorations/Callout.tsx, by way of vue-wordgard's) for
  Svelte: a callout after Stesura's, a title bar of chrome above the content. The icon picks the
  kind, a double-click on the title edits it. Drawn with DecorationRoot: the callout type's own
  <aside class="callout">.
-->
<script lang="ts">
  import { CalloutKind, type CalloutKindName, CalloutTitle, calloutKinds } from "../../schema.js";
  import {
    DecorationRoot,
    type ShapeComponentProps,
    useNodePos,
    useStopEvent,
    useWordgard,
  } from "@stesura/svelte-wordgard";
  import KindPicker from "./KindPicker.svelte";
  import Title from "./Title.svelte";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
  const wg = useWordgard();
  const getPos = useNodePos();
  const kind = $derived(nodeProps.node.tag.mark(CalloutKind) ?? "note");
  const title = $derived(nodeProps.node.tag.mark(CalloutTitle));

  // The bar's events are its controls', not the editor's.
  let bar = $state<HTMLElement | null>(null);
  useStopEvent((_wg, event) => event.target instanceof Node && !!bar?.contains(event.target));

  const setKind = (next: CalloutKindName) => {
    wg.dispatch({ changes: { from: getPos(), add: CalloutKind.of(next) } });
    wg.focus();
  };
  // `null` cancels; a blur doesn't pull the focus back from where it went.
  const finishTitle = (next: string | null, refocus: boolean) => {
    const from = getPos();
    if (next && next != title) wg.dispatch({ changes: { from, add: CalloutTitle.of(next) } });
    else if (next == "" && title)
      wg.dispatch({ changes: { from, remove: CalloutTitle.of(title) } });
    if (refocus) wg.focus();
  };
</script>

<DecorationRoot {...rest} data-kind={kind}>
  <div bind:this={bar} class="callout-title">
    <KindPicker {kind} onpick={setKind} />
    <Title {title} placeholder={calloutKinds[kind].label} onfinish={finishTitle} />
  </div>
  <div class="callout-body" {@attach contentDOMRef}></div>
</DecorationRoot>
