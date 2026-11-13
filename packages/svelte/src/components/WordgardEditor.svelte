<!--
  Adapted from react-wordgard's WordgardEditor (by way of vue-wordgard's) for Svelte. The spec is
  read once: Wordgard's editor owns its state.
-->
<script lang="ts">
  import { type Snippet, setContext, untrack } from "svelte";
  import type { Wordgard } from "wordgard/editor";

  import { editorOf } from "@stesura/wordgard-view";
  import { SvelteWordgard } from "../SvelteWordgard.js";
  import { EditorKey } from "../contexts/EditorContext.js";

  type Props = Omit<Wordgard.Spec, "parent"> & { children?: Snippet };

  let { children, ...spec }: Props = $props();
  const wg = untrack(() =>
    SvelteWordgard.host({
      doc: spec.doc,
      config: spec.config,
      selection: spec.selection,
      state: spec.state,
      scrollTo: spec.scrollTo,
    })
  );
  setContext(EditorKey, editorOf(wg));
</script>

{@render children?.()}
