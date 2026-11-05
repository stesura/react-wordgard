// Two alike schemas: paragraphs (an indent, an "edited" flag), headings, bold, italic, links, a
// colour and a font size. ProseMirror's holds the colour and size in one textStyle mark, as
// tiptap's does; Wordgard's has a mark per value, its idiom.
import { Schema } from "prosemirror-model";
import { schema as basic } from "prosemirror-schema-basic";
import { Mark } from "wordgard/doc";
import { history } from "wordgard/history";
import { basicSchema } from "wordgard/schema";
import { GardState } from "wordgard/state";
import { Color, Paragraph } from "wordgard/types";

const indentPx = 24;

const style = (entries: [string, unknown][]) =>
  entries
    .filter(([, value]) => value != null)
    .map(([name, value]) => `${name}: ${String(value)}`)
    .join("; ");

export const pmSchema = new Schema({
  nodes: basic.spec.nodes.update("paragraph", {
    content: "inline*",
    group: "block",
    attrs: { indent: { default: 0 }, edited: { default: false } },
    parseDOM: [
      {
        tag: "p",
        getAttrs: (dom) => ({
          indent: Math.round(parseFloat(dom.style.marginLeft || "0") / indentPx),
          edited: dom.hasAttribute("data-edited"),
        }),
      },
    ],
    toDOM: (node) => [
      "p",
      {
        ...(node.attrs.indent
          ? { style: `margin-left: ${Number(node.attrs.indent) * indentPx}px` }
          : {}),
        ...(node.attrs.edited ? { "data-edited": "true" } : {}),
      },
      0,
    ],
  }),
  marks: basic.spec.marks.addToEnd("textStyle", {
    attrs: { color: { default: null }, fontSize: { default: null } },
    parseDOM: [
      {
        tag: "span[style]",
        getAttrs: (dom) => {
          const color = dom.style.color || null;
          const fontSize = dom.style.fontSize || null;
          return color || fontSize ? { color, fontSize } : false;
        },
      },
    ],
    toDOM: (mark) => [
      "span",
      {
        style: style([
          ["color", mark.attrs.color],
          ["font-size", mark.attrs.fontSize],
        ]),
      },
      0,
    ],
  }),
});

export const Indent = Mark.Type.define<number>("Indent", {
  target: Paragraph,
  keepOnSplit: true,
  validate: "number",
  shape: {
    attribute: "style/margin-left",
    value: (indent) => (indent ? `${indent * indentPx}px` : null),
    readAttribute: (value) => Math.round(parseFloat(value) / indentPx),
  },
});

export const FontSize = Mark.Type.define<string>("FontSize", {
  rank: 31,
  validate: "string",
  spanning: true,
  shape: { attribute: "style/font-size", value: 0 },
});

export const Edited = Mark.Type.define<string>("Edited", {
  target: Paragraph,
  validate: "string",
  shape: { attribute: "data-edited", value: 0 },
});

export const wgSchema = [
  basicSchema(),
  GardState.schemaElement.of([Color, FontSize, Indent, Edited]),
  history(),
];
