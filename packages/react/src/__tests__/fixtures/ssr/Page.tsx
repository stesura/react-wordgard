// A page as a server-rendering framework (Next) renders it on the server, then hydrates: an editor
// between static parts, with chrome reading the editor next to its document.
import React, { forwardRef } from "react";
import { Decoration } from "wordgard/editor";
import { basicSchema, blockquote } from "wordgard/schema";
import { Blockquote } from "wordgard/types";

import { WordgardDoc } from "../../../components/WordgardDoc.js";
import { WordgardEditor } from "../../../components/WordgardEditor.js";
import { type ShapeComponentProps, createShape } from "../../../decorations/ReactShapeType.js";
import { useEditorStateSelector } from "../../../hooks/useEditorStateSelector.js";

const Note = forwardRef<HTMLQuoteElement, ShapeComponentProps<HTMLQuoteElement>>(
  ({ nodeProps: { contentDOMRef }, children, ...attrs }, ref) => (
    <blockquote {...attrs} ref={ref} data-note="">
      <div ref={contentDOMRef}>{children}</div>
    </blockquote>
  )
);

const config = [basicSchema(), blockquote(), Decoration.Tag.shape(Blockquote, createShape(Note))];

const Status = () => <output>{useEditorStateSelector((state) => state.doc.length)}</output>;

export const Page = () => (
  <>
    <h1>Title</h1>
    <WordgardEditor doc="<p>Hello</p><blockquote><p>quoted</p></blockquote>" config={config}>
      <Status />
      <WordgardDoc className="editor" />
    </WordgardEditor>
    <footer>After</footer>
  </>
);
