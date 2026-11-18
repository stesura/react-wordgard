// WordgardEditor.browser.test.ts's callback-order page, rendered on the server and hydrated: the
// document first draws on an update pass there, once the page has mounted.
import { defineComponent, h, onMounted, shallowRef } from "vue";
import { Decoration } from "wordgard/editor";
import { basicSchema } from "wordgard/schema";
import { Paragraph } from "wordgard/types";

import { WordgardDoc } from "../../../components/WordgardDoc.js";
import { WordgardEditor } from "../../../components/WordgardEditor.js";
import { createWidgetTypeWithRender } from "../../../decorations/VueWidgetType.js";

export const log: string[] = [];

const probe = (name: string) =>
  defineComponent(() => {
    const element = shallowRef<HTMLElement | null>(null);
    onMounted(() => log.push(`${name} ${element.value?.isConnected}`));
    return () => h("i", { ref: element });
  });

const Widgeted = defineComponent({
  props: ["value"],
  setup: (props: { value: string }) => {
    const element = shallowRef<HTMLElement | null>(null);
    onMounted(() => log.push(`widget ${element.value?.isConnected}`));
    return () => h("span", { ref: element, class: "w" }, props.value);
  },
});

const Mounted = createWidgetTypeWithRender({
  render: (value: string) => Object.assign(document.createElement("span"), { textContent: value }),
  component: Widgeted,
});

const config = [basicSchema(), Decoration.Tag.widget(Paragraph, "start", Mounted.of("m"))];

const Before = probe("before");
const After = probe("after");

export const Callbacks = defineComponent(
  () => () =>
    h(WordgardEditor, { doc: "<p>a</p>", config }, () => [h(Before), h(WordgardDoc), h(After)])
);
