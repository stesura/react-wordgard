// A page as a server-rendering framework (Nuxt) renders it on the server, then hydrates: an editor
// between static parts, with chrome reading the editor next to its document. Render functions, as
// the server has no template compiler loaded.
import { computed, defineComponent, h } from "vue";
import { Decoration } from "wordgard/editor";
import { basicSchema, blockquote } from "wordgard/schema";
import { Blockquote } from "wordgard/types";

import { DecorationRoot } from "../../../components/DecorationRoot.js";
import { NodeContent } from "../../../components/NodeContent.js";
import { WordgardDoc } from "../../../components/WordgardDoc.js";
import { WordgardEditor } from "../../../components/WordgardEditor.js";
import { createShape } from "../../../decorations/VueShapeType.js";
import { useEditorState } from "../../../hooks/useEditorState.js";

const Note = defineComponent({
  props: ["nodeProps"],
  setup: () => () => h(DecorationRoot, { "data-note": "" }, () => h(NodeContent, { as: "div" })),
});

const config = [basicSchema(), blockquote(), Decoration.Tag.shape(Blockquote, createShape(Note))];

const Status = defineComponent(() => {
  const state = useEditorState();
  const length = computed(() => state.value.doc.length);
  return () => h("output", String(length.value));
});

export const Page = defineComponent(() => () => [
  h("h1", "Title"),
  h(WordgardEditor, { doc: "<p>Hello</p><blockquote><p>quoted</p></blockquote>", config }, () => [
    h(Status),
    h(WordgardDoc, { class: "editor" }),
  ]),
  h("footer", "After"),
]);
