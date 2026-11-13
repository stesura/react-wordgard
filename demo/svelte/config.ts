// Adapted from react-wordgard's demo (demo/main.tsx, by way of vue-wordgard's demo/vue/main.ts) for
// Svelte: the demo's configuration, with one Svelte decoration of each kind.
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

import { Callout, CalloutKind, CalloutTitle, Mention } from "../schema.js";
import { createMarkShape, createShape, createWidgetType } from "@stesura/svelte-wordgard";
import CalloutView from "./decorations/Callout.svelte";
import FigureView from "./decorations/Figure.svelte";
import LinkView from "./decorations/Link.svelte";
import MentionView from "./decorations/Mention.svelte";
import Picture from "./decorations/Picture.svelte";
import type { FigureValue } from "./decorations/figureValue.js";
import { insertImage } from "./insertImage.js";

const CalloutShape = createShape(CalloutView);
const LinkShape = createMarkShape(LinkView, { element: "a" });
const ResizableFigure = createWidgetType<FigureValue>({
  eq: (a, b) => a.src == b.src && a.alt == b.alt && a.width == b.width,
  component: FigureView,
  element: "figure",
});
const MentionWidget = createWidgetType<string>({ component: MentionView });
const PictureWidget = createWidgetType<string>({ component: Picture, element: "img" });

const calloutButton = Menu.Button.define({
  run: Command.bind(toggleBlock, Callout),
  label: "Callout",
  description: "Toggle a callout",
  enable: (state) => !state.readOnly,
  parent: Menu.Group.insert,
});

export const config = [
  blockDoc(),
  paragraph(),
  heading(),
  blockquote(),
  bulletList(),
  orderedList(),
  codeBlock(),
  // inlineMarks() without link.tooltip: LinkView draws the link's card.
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
  Decoration.Tag.shape(Image, (tag) => PictureWidget.of(tag.param)),
  Decoration.Mark.shape(Link, LinkShape),
];
