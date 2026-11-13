<!--
  A quote: a tool button whose events Wordgard doesn't handle, a label it does, the selection as an
  attribute, two keydown listeners.
-->
<script lang="ts">
  import { Wordgard } from "wordgard/editor";

  import type { ShapeComponentProps } from "../../../decorations/SvelteShapeType.js";
  import { useEditorEventListener } from "../../../hooks/useEditorEventListener.js";
  import { useIgnoreMutation } from "../../../hooks/useIgnoreMutation.js";
  import { useIsNodeSelected } from "../../../hooks/useIsNodeSelected.js";
  import { useNodePos } from "../../../hooks/useNodePos.js";
  import { useSelectNode } from "../../../hooks/useSelectNode.svelte.js";
  import { useStopEvent } from "../../../hooks/useStopEvent.js";
  import { obey, seen } from "./probes.js";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
  seen.positions.set("quote", useNodePos());
  const selected = useIsNodeSelected();
  useStopEvent((_, event) => event.target instanceof Element && !!event.target.closest(".tool"));
  useIgnoreMutation(() => obey.ignore);
  useSelectNode(
    () => seen.selections.push("select"),
    () => seen.selections.push("deselect")
  );
  useEditorEventListener("keydown", (wg, event) => {
    seen.listened.push(`first ${event.key} ${wg instanceof Wordgard}`);
    return obey.handle;
  });
  useEditorEventListener("keydown", (_, event) => {
    seen.listened.push(`second ${event.key}`);
  });
</script>

<blockquote {...rest} data-selected={String(selected.current)}>
  <button class="tool">t</button>
  <span class="label">l</span>
  <div class="body" {@attach contentDOMRef}></div>
</blockquote>
