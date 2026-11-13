<!--
  Adapted from react-wordgard's WordgardEditor (by way of vue-wordgard's) for Svelte. The spec is
  read once: Wordgard's editor owns its state. Not on the server (SvelteKit's first render): Wordgard
  needs the DOM, to read its document's HTML too. The children are drawn in the browser only, where
  hydration discards the server's empty branch of the `{#if}`.
-->
<script lang="ts">
  import { BROWSER } from "esm-env";
  import { type Snippet, setContext, untrack } from "svelte";
  import type { Wordgard } from "wordgard/editor";

  import { editorOf } from "@stesura/wordgard-view";
  import { SvelteWordgard } from "../SvelteWordgard.js";
  import { EditorKey } from "../contexts/EditorContext.js";

  type Props = Omit<Wordgard.Spec, "parent"> & { children?: Snippet };

  let { children, ...spec }: Props = $props();
  const wg = BROWSER
    ? untrack(() =>
        SvelteWordgard.host({
          doc: spec.doc,
          config: spec.config,
          selection: spec.selection,
          state: spec.state,
          scrollTo: spec.scrollTo,
        })
      )
    : null;
  if (wg) setContext(EditorKey, editorOf(wg));
</script>

{#if wg}{@render children?.()}{/if}
