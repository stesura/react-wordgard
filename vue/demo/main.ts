// Adapted from react-wordgard's demo (demo/main.tsx) for Vue: the same editor, with every kind of
// Vue decoration. The components are templates compiled in the browser (vite.config.ts takes Vue's
// full build), so the demo needs no single-file component tooling.
import "../../demo/main.css";

import { computed, createApp, defineComponent, ref } from "vue";
import { Command, Menu, toggleBlock } from "wordgard/command";
import { Decoration, Wordgard, dropCursor, menuBar } from "wordgard/editor";
import { history } from "wordgard/history";
import {
  alignment,
  backgroundColor,
  blockDoc,
  blockquote,
  bulletList,
  code,
  codeBlock,
  color,
  emphasis,
  heading,
  horizontalRule,
  lineBreak,
  link,
  orderedList,
  paragraph,
  strikethrough,
  strong,
  subscript,
  superscript,
  underline,
} from "wordgard/schema";
import { GardState } from "wordgard/state";
import {
  CaptionedFigure,
  Cell,
  Figure,
  HeaderCell,
  Image,
  ImageAlt,
  ImageSize,
  Link,
  Table,
  TableRow,
} from "wordgard/types";

import { docFor } from "../../demo/doc.js";
import { Callout, CalloutKind, CalloutTitle, Mention } from "../../demo/schema.js";
import {
  WordgardDoc,
  WordgardEditor,
  createWidgetType,
  useEditorEffect,
  useEditorState,
} from "../src/index.js";
import { InsertImage, insertImage } from "./InsertImage.js";
import { MentionMenu } from "./MentionMenu.js";
import { TextMenu } from "./TextMenu.js";
import { CalloutShape } from "./decorations/Callout.js";
import { ResizableFigure } from "./decorations/Figure.js";
import { LinkShape } from "./decorations/Link.js";
import { MentionWidget } from "./decorations/Mention.js";

declare global {
  interface Window {
    wg?: Wordgard;
  }
}

// An image drawn by Vue, with state of its own: hovering outlines it.
const VueImage = createWidgetType<string>({
  component: defineComponent({
    props: ["value"],
    setup: () => ({ hover: ref(false) }),
    template: `
      <img
        :src="value"
        :style="hover ? { outline: '2px solid #6af' } : undefined"
        @mouseover="hover = true"
        @mouseout="hover = false"
      />`,
  }),
});

const calloutButton = Menu.Button.define({
  run: Command.bind(toggleBlock, Callout),
  label: "Callout",
  description: "Toggle a callout",
  enable: (state) => !state.readOnly,
  parent: Menu.Group.insert,
});

const WordCount = defineComponent({
  setup() {
    const state = useEditorState();
    const words = computed(() => state.value.doc.textContent().split(/\s+/).filter(Boolean).length);
    return { words };
  },
  template: `<p class="word-count">{{ words }} words</p>`,
});

// The editor, for the console.
const Expose = defineComponent(() => {
  useEditorEffect((wg) => {
    window.wg = wg;
  });
  return () => null;
});

const config = [
  blockDoc(),
  paragraph(),
  heading(),
  blockquote(),
  bulletList(),
  orderedList(),
  codeBlock(),
  // inlineMarks() without link.tooltip: LinkShape draws the link's card.
  strong(),
  emphasis(),
  GardState.schemaElement.of(Link),
  link.button,
  link.keyBinding,
  link.pasteOver,
  code(),
  underline(),
  strikethrough(),
  superscript(),
  subscript(),
  color(),
  backgroundColor(),
  alignment(),
  lineBreak(),
  horizontalRule(),
  GardState.schemaElement.of([
    Callout,
    CalloutKind,
    CalloutTitle,
    Mention,
    Image,
    Figure,
    ImageAlt,
    ImageSize,
    CaptionedFigure,
    Table,
    TableRow,
    Cell,
    HeaderCell,
  ]),
  history(),
  menuBar(),
  dropCursor(),
  calloutButton,
  insertImage,
  Wordgard.label("Demo document"),
  Decoration.Tag.shape(Callout, CalloutShape),
  Decoration.Tag.shape(Figure, (tag) =>
    ResizableFigure.of({ src: tag.param, alt: tag.mark(ImageAlt), width: tag.mark(ImageSize) })
  ),
  Decoration.Tag.shape(Mention, (tag) => MentionWidget.of(tag.param)),
  Decoration.Tag.shape(Image, (tag) => VueImage.of(tag.param)),
  Decoration.Mark.shape(Link, LinkShape),
];

const App = defineComponent({
  components: {
    WordgardEditor,
    WordgardDoc,
    Expose,
    InsertImage,
    TextMenu,
    MentionMenu,
    WordCount,
  },
  setup: () => ({ doc: docFor("vue-wordgard", "Vue"), config }),
  template: `
    <WordgardEditor :doc="doc" :config="config">
      <Expose />
      <WordgardDoc />
      <InsertImage />
      <TextMenu />
      <MentionMenu />
      <WordCount />
    </WordgardEditor>`,
});

createApp(App).mount("#editor");
