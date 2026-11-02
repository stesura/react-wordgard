// Adapted from Wordgard's demo (demo/demo.ts in its repo), on react-wordgard's
// components, with every kind of React decoration: a shape (the callout), a
// widget drawing a block node (the resizable figure) and an inline one (the
// mention, the inline image), and a mark shape (the link). Tables come as bare
// schema elements, without their extension's cell selection.
import "./main.css";

import React, { StrictMode, forwardRef, useState } from "react";
import { createRoot } from "react-dom/client";
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
  ImageSize,
  Link,
  Table,
  TableRow,
} from "wordgard/types";

import {
  WordgardDoc,
  WordgardEditor,
  createWidgetType,
  useEditorEffect,
  useEditorStateSelector,
} from "../src/index.js";
import { MentionMenu } from "./MentionMenu.js";
import { TextMenu } from "./TextMenu.js";
import { CalloutShape } from "./decorations/Callout.js";
import { ResizableFigure } from "./decorations/Figure.js";
import { LinkShape } from "./decorations/Link.js";
import { MentionWidget } from "./decorations/Mention.js";
import { doc } from "./doc.js";
import { Callout, CalloutKind, CalloutTitle, Mention } from "./schema.js";

declare global {
  interface Window {
    wg?: Wordgard;
  }
}

// An image drawn by React, with state of its own: hovering outlines it.
const ImageView = forwardRef<HTMLImageElement, { value: string }>(({ value }, ref) => {
  const [hover, setHover] = useState(false);
  return (
    <img
      ref={ref}
      src={value}
      style={hover ? { outline: "2px solid #6af" } : undefined}
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
    />
  );
});
const ReactImage = createWidgetType({ component: ImageView });

const calloutButton = Menu.Button.define({
  run: Command.bind(toggleBlock, Callout),
  label: "Callout",
  description: "Toggle a callout",
  enable: (state) => !state.readOnly,
  parent: Menu.Group.insert,
});

const WordCount = () => {
  const words = useEditorStateSelector(
    (state) => state.doc.textContent().split(/\s+/).filter(Boolean).length
  );
  return <p className="word-count">{words} words</p>;
};

// The editor, for the console.
const Expose = () => {
  useEditorEffect((wg) => {
    window.wg = wg;
  }, []);
  return null;
};

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
  Wordgard.contentAttributes.of({ "aria-label": "Demo document" }),
  Decoration.Tag.shape(Callout, CalloutShape),
  ResizableFigure.shape(Figure, (tag) => ({ src: tag.param, width: tag.mark(ImageSize) })),
  MentionWidget.shape(Mention),
  ReactImage.shape(Image),
  Decoration.Mark.shape(Link, LinkShape),
];

const root = document.getElementById("editor");
if (!root) throw new Error("No #editor element");

createRoot(root).render(
  <StrictMode>
    <WordgardEditor doc={doc} config={config}>
      <Expose />
      <WordgardDoc />
      <TextMenu />
      <MentionMenu />
      <WordCount />
    </WordgardEditor>
  </StrictMode>
);
