# Wordgard, for ProseMirror developers

Read this when you're new to Wordgard or porting ProseMirror code (react-prosemirror apps
included). It covers the model and the traps; for exact signatures, read the typings in
`node_modules/wordgard/dist/*.d.ts`, whose doc comments are Wordgard's reference manual. Wordgard's
own guides: https://wordgard.net/docs/guide/ and, for ProseMirror users,
https://wordgard.net/docs/prosemirror/. Written for Wordgard 0.6.

## Modules

One package, `wordgard`, in submodules:

| Wordgard           | Replaces                                                                            |
| ------------------ | ----------------------------------------------------------------------------------- |
| `wordgard/doc`     | `prosemirror-model`, `prosemirror-transform`                                        |
| `wordgard/state`   | `prosemirror-state`                                                                 |
| `wordgard/editor`  | `prosemirror-view`, `prosemirror-keymap`, `prosemirror-menu`, input rules           |
| `wordgard/command` | `prosemirror-commands`                                                              |
| `wordgard/history` | `prosemirror-history`                                                               |
| `wordgard/collab`  | `prosemirror-collab`                                                                |
| `wordgard/types`   | `prosemirror-schema-basic`, `prosemirror-schema-list`: the node and mark types      |
| `wordgard/schema`  | extensions adding those types with their commands, keys and menus (`basicSchema()`) |

## The document

- **A node is a plot or a leaf.** A `Plot` has content (`plot.content`, an array); a `Leaf` has
  none. Text is a leaf (`Leaf.Text`, its parameter the string), and so is a line break.
- **A tag is a node's type, parameter and marks.** A leaf is its own tag; a plot has one
  (`plot.tag`). Read a parameter as `plot.tag.param` or `leaf.param`, a mark as
  `node.tag.mark(Type)` (the value, or `undefined`).
- **One parameter, no `attrs`.** What identifies a node (a heading's level, an image's `src`) is
  its parameter. Anything else (alignment, size, a callout's kind) is a mark on its tag: a mark
  type with a `target`, added or removed without touching the node.
- **Marks live on tags**, a plot's as a leaf's, and a mark type says which nodes it may go on
  (`target`), not the parent which content it allows.
- **No content expressions.** A plot type says what it holds (`blockContent: Node.Group.Content`,
  or `inlineContent: true`); finer rules go above the document (corrections, `wordgard/state`).
- **Positions count as in ProseMirror**: a character or leaf is 1, a plot 2 plus its content.
  `node.length` is ProseMirror's `nodeSize`; the document's excludes its own tokens.
- **Walking it:** `doc.iterate(from, to, (node, pos, parent, index) => …)` for `descendants` and
  `nodesBetween` (return `false` to skip a node's content), `doc.nodeAt(pos)`, `doc.plotAt(pos)`,
  `doc.resolve(pos)` (a `Pos`, ProseMirror's `ResolvedPos`), `plot.textContent({ blockSeparator })`.
- **Types are objects, not names.** Import them (`Heading`, `Paragraph` from `wordgard/types`) and
  compare with `node.type == Heading` or `node.is(Heading)`; names are for JSON and debugging.

### Defining types

```ts
import { Leaf, Mark, Node, Plot } from "wordgard/doc";
import { GardState } from "wordgard/state";

// A plot without a parameter: `define` gives its tag.
export const Callout = Plot.define("Callout", {
  blockContent: Node.Group.Content,
  group: Node.Group.Content,
  shape: { element: "aside", selector: "aside.callout", attributes: { class: "callout" } },
});

// Data an editing action changes is a mark on the tag, not a parameter.
export const CalloutKind = Mark.Type.define<string>("CalloutKind", {
  target: Callout,
  validate: "string",
  shape: { attribute: "data-kind", value: 0 },
});

// A leaf with a parameter: `Type.define`, and nodes are `Mention.of(param)`.
export const Mention = Leaf.Type.define<string>("Mention", {
  inline: true,
  validate: "string",
  shape: {
    element: "span",
    selector: "span[data-mention]",
    attributes: (id) => ({ "data-mention": id }),
    readElement: (elt) => elt.getAttribute("data-mention") ?? "",
  },
});

// The schema is assembled from the configuration.
export const schemaPart = GardState.schemaElement.of([Callout, CalloutKind, Mention]);
```

- `Plot.define` / `Leaf.define` / `Mark.define` for types without a parameter;
  `Plot.Type.define<P>` / `Leaf.Type.define<P>` / `Mark.Type.define<P>` with one (`Heading.of(2)`).
- `shape` is both `toDOM` and `parseDOM`: an element (with `selector` and `readElement` for
  parsing) or, for a mark, an attribute merged onto its node's element. A `structure` shape draws
  inner elements; `0` marks where the content goes.

## Changes

ProseMirror's steps are gone. A transaction is a spec, every position in it counts in the
document before it, and its changes are one `ChangeSet`, which also maps positions.

```ts
import type { Node } from "wordgard/doc";
import type { Wordgard } from "wordgard/editor";
import { Heading, Strong } from "wordgard/types";

export const examples = (wg: Wordgard, pos: number, node: Node, target: number) => {
  // Insert, mark a range, delete: all in the original document's positions.
  wg.dispatch({
    changes: [
      { from: 1, insert: [node] },
      { from: 8, to: 10, add: Strong },
      { from: 20, to: 30 },
    ],
    selection: { anchor: 2 },
  });
  // A parameter change: replace the node's opening token by one of the same type.
  wg.dispatch({ changes: { from: pos, to: pos + 1, insert: [Heading.of(2)] } });
  // A move: delete the node and insert the same object elsewhere.
  wg.dispatch({
    changes: [
      { from: pos, to: pos + node.length },
      { from: target, insert: [node] },
    ],
  });
};
```

| ProseMirror                                | Wordgard                                                                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `tr.insert`, `tr.replaceWith`, `tr.delete` | `changes: { from, to?, insert? }`; `insert` is an array of tokens                                                            |
| `tr.addMark`, `tr.removeMark`              | `{ from, to, add: Mark }`, `{ from, to, remove: Mark }`                                                                      |
| `tr.setNodeMarkup`, `tr.setNodeAttribute`  | a retag (`{ from: pos, to: pos + 1, insert: [Type.of(param)] }`) or a mark on the tag (`{ from: pos, add: Type.of(value) }`) |
| `tr.mapping.map(pos)`                      | `tr.changes.mapPos(pos, assoc?)`                                                                                             |
| `tr.setMeta`                               | `Transaction.Annotation` (about the transaction), `Transaction.Effect` (a change to state, mapped through changes)           |
| `tr.steps`, `tr.docChanged`                | `tr.changes`, `tr.docChanged`                                                                                                |
| `state.apply(tr)`                          | `tr.state` (`state.update(spec)` builds the transaction)                                                                     |
| `Slice` with open depths                   | `Slice`, a flat run of tokens: nodes, `Plot.Tag` (an opening token), `Plot.End`                                              |

## Configuration

- **Extensions, not plugins.** The configuration is a tree of extensions (CodeMirror 6's system):
  facets (`GardState.Facet`), state fields, precedence (`GardState.prec.highest(…)`), and
  compartments (`new GardState.Compartment()`, `.of(…)`, `.reconfigure(…)` in an effect) or
  `GardState.appendConfig` to change it later.
- **Plugin state** is a field: `GardState.Field.define({ create, update: (value, tr) => …, provide })`.
- **Plugin views** are `Wordgard.Plugin.define((wg) => ({ update(update) {}, docUpdate(wg) {} }))`.
- **Props** are facets: `Wordgard.domEventHandler(type, (event, wg) => handled)`,
  `Wordgard.contentAttributes.of({…})`, `Wordgard.updateListener.of((update) => …)`, decorations.
- **Keymaps:** `KeyBinding.of({ key: "Mod-b", run: command })`, each binding an extension.
- **Commands** are `(wg, param) => boolean | Transaction.Spec`, run with
  `Command.dispatch(wg, command, param?)`. `Command.Pure` takes `{ state }` and returns a spec or
  `false`; `Command.bind(command, param)` fixes the parameter for menus and keys;
  `Command.handler(command, other)` lets an extension change what a command does.
- **History:** `history()` from `wordgard/history`, with the `undo` and `redo` commands.
- **HTML and JSON:** `parse(schema, element)` and `serialize(doc).toHTML()` from `wordgard/doc`;
  `node.toJSON()` and `state.schema.nodeFromJSON(json)`. A spec's `doc` may be an HTML string.

## Selection

- `state.selection` (`GardSelection`) holds raw positions (`anchor`, `head`, `from`, `to`,
  `empty`); `state.sel` the resolved ones (`sel.head.parent.node`).
- Set it in a spec, `selection: { anchor, head? }`, or with `GardSelection.node(pos, node)` for a
  node selection.

## The editor

- **`Wordgard`** is the view. It updates the DOM asynchronously, on the next frame (its _flush_):
  read layout with `coordsAtPos` and the like, which flush first, or after `wg.flush()`. A
  dispatch during the flush throws.
- **It draws its own cursor** and handles selection keys itself; bind commands to them.
- **Decorations** come as point decorations (`Decoration.Point`: widgets, attributes, a node's
  shape or wrapper, at a position), range decorations (`Decoration.Range`: wrappers and attributes
  over a range) and tag decorations (`Decoration.Tag`: for every node of a type, in place of node
  views). Point and range sources are functions of the state called on every update: keep large
  sets in a state field and map them (`set.map(tr.changes)`). `decoratePlots` decorates each plot
  of a type from its own content.
- **No node views.** A node's DOM is its shape; interactive parts are widgets in it, beside its
  content. With react-wordgard, a React component can be the shape: see `SKILL.md`.

## Traps

- **Don't replace a node to change its data.** `{ from, to, insert: [newNode] }` makes a new node:
  views remount, and history and collaboration see a replacement. Retag or change a mark.
- **Don't carry ProseMirror's `attrs` over as one object parameter.** Split identity (the
  parameter) from data that changes (marks with a `target`).
- **Positions in one spec all count in the original document**: don't adjust the later ones for
  the earlier changes, as with ProseMirror's step-by-step mapping.
- **Refer to types by object.** `node.type.name == "heading"` breaks when the name differs and
  can't tell two types with one name apart.
- **Don't read layout right after `dispatch`** without letting the editor flush; and never
  dispatch from inside an update (a plugin's `update`, a field's `update`).
- **Point and range sources run on every update**: computing a big set there costs every
  keystroke.
- **Drag-and-drop inside the editor rebuilds what it moves from HTML** (Wordgard 0.6): moved nodes
  are new objects, and whatever their HTML doesn't carry is lost.
- **`Wordgard.label` names the outer element in 0.6.2**, not the textbox: use
  `Wordgard.contentAttributes.of({ "aria-label": … })`.
