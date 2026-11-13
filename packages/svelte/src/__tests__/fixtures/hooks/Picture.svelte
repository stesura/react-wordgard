<!-- A widget drawing an image node: the node's attributes on its root, its mounts counted. -->
<script lang="ts">
  import type { WidgetComponentProps } from "../../../decorations/SvelteWidgetType.js";
  import { useIgnoreMutation } from "../../../hooks/useIgnoreMutation.js";
  import { useNodePos } from "../../../hooks/useNodePos.js";
  import { useSelectNode } from "../../../hooks/useSelectNode.svelte.js";
  import PictureView from "./PictureView.svelte";
  import { mounts, obey, seen } from "./probes.js";

  let { value, ...rest }: WidgetComponentProps<null> = $props();
  const mount = ++mounts.picture;
  seen.positions.set("picture", useNodePos());
  useIgnoreMutation(() => obey.ignoreAll);
  useSelectNode(
    () => seen.selections.push(`picture select ${mount}`),
    () => seen.selections.push(`picture deselect ${mount}`)
  );
</script>

<span {...rest} data-frame=""><PictureView /></span>
