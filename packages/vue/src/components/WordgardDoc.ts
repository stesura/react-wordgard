// Adapted from react-wordgard's WordgardDoc for Vue: no portal (a Teleport would put its anchors in
// the content element), but the document rendered into the content element with render(), its
// components given this component's provides (VueDocTile). Drawn from `onMounted`, where Vue's
// render() runs none of the app's pending callbacks early; attaching the element then connects the
// editor, as Wordgard's own editor is built before it's connected.
import {
  defineComponent,
  getCurrentInstance,
  h,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  shallowRef,
} from "vue";

import { editorOf } from "@stesura/wordgard-view";
import { vueDoc } from "../VueDocTile.js";
import { useEditorContext } from "../contexts/EditorContext.js";

/**
 * Puts the editor in the page, inside a `div` taking the attributes, and draws the document there,
 * its components under this one for `inject`. It goes under its `<WordgardEditor>`, inside any
 * other components, with other components before or after it. One per editor: a second throws.
 */
export const WordgardDoc = defineComponent(() => {
  const { wg } = useEditorContext("WordgardDoc");
  const host = getCurrentInstance();
  if (!host) throw new Error("WordgardDoc is set up outside a component");
  const doc = vueDoc(wg.contentDOM);
  const element = shallowRef<HTMLDivElement | null>(null);
  const release = doc.claim();
  let parent: HTMLDivElement | null = null;
  let detach = () => {};
  onMounted(() => {
    parent = element.value;
    detach = doc.attach(host);
    parent?.appendChild(wg.dom);
    // Effects waiting for the editor to be in the page.
    editorOf(wg).requestEffects();
  });
  // Released as soon as it goes, for a WordgardDoc mounted in its place.
  onBeforeUnmount(release);
  // The editor leaves the page first: a <Transition> keeps the element there
  // while it leaves, where the editor would draw what was taken away. Not
  // when another WordgardDoc has it already.
  onUnmounted(() => {
    if (parent && wg.dom.parentNode == parent) wg.dom.remove();
    detach();
  });
  return () => h("div", { ref: element });
});
