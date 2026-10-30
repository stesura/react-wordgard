import { schema } from "./schema.js";

const { nodes, marks } = schema;

function p(...content: (string | ReturnType<typeof schema.text>)[]) {
  return nodes.paragraph.create(
    {},
    content.map((c) => (typeof c == "string" ? schema.text(c) : c))
  );
}

function cell(type: typeof nodes.table_cell, text: string) {
  return type.create({}, p(text));
}

export const doc = nodes.doc.create({}, [
  nodes.heading.create({ level: 1 }, schema.text("react-wordgard demo")),
  p(
    "This demo still runs the ProseMirror view. Try ",
    schema.text("bold", [marks.strong.create()]),
    ", ",
    schema.text("italic", [marks.em.create()]),
    ", ",
    schema.text("code", [marks.code.create()]),
    " and a ",
    schema.text("link", [marks.link.create({ url: "https://wordgard.net" })]),
    "."
  ),
  nodes.list.create({}, [
    nodes.list_item.create({}, p("A list item")),
    nodes.list_item.create({}, p("Another one")),
  ]),
  nodes.code_block.create({}, schema.text("const answer = 42;")),
  nodes.table.create({}, [
    nodes.table_row.create({}, [
      cell(nodes.table_header, "Column A"),
      cell(nodes.table_header, "Column B"),
    ]),
    nodes.table_row.create({}, [cell(nodes.table_cell, "1"), cell(nodes.table_cell, "2")]),
  ]),
  p("The end."),
]);
