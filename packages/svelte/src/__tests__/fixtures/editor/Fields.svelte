<!-- Logs each of its field reads, by name, whenever it changes. -->
<script lang="ts">
  import { useEditorField, useEditorFieldEntry } from "../../../hooks/useEditorField.svelte.js";
  import { counter, entries, length } from "./fields.js";
  import { log } from "./probes.js";

  const count = useEditorField(counter);
  const parity = useEditorField(counter, (n) => n % 2);
  const docLength = useEditorField(length);
  const x = useEditorFieldEntry(entries, "x");
  const y = useEditorFieldEntry(entries, "y");
  const xn = $derived(x.current?.n);
  const yn = $derived(y.current?.n);
  $effect(() => log("count", count.current));
  $effect(() => log("parity", parity.current));
  $effect(() => log("entry:x", xn));
  $effect(() => log("entry:y", yn));
  $effect(() => log("length", docLength.current));
</script>
