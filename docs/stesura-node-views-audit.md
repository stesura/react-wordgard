# Stesura's node views against Wordgard's shapes (2026-11-01)

Whether the React node views in Stesura's `packages/editor-react/src/node-views/` fit Wordgard's
model: a node draws as a shape (an `Elt` with a content hole, from tag decorations), with React
widgets for the uneditable, interactive parts. Read from the code; the table and context findings
were spot-checked (callout, table cell). Not audited: the views other packages register or wrap,
above all `pagination-react`, which replaces section, text block, header/footer, row and cell
views (`pagination-react/src/ui-extensions.tsx`).

## Verdict

No view needs a React component around its editable content because of its own React state:
every piece of local state (a callout's title editing, upload progress, resize drafts, KaTeX
rendering) sits in an uneditable part, which becomes a React widget. What the structure around
content depends on is React context and external stores, which would have to become editor
state, read by decorations.

| Node view | Content | Fits as | What it needs |
|---|---|---|---|
| callout | yes | shape + widgets | Title bar (`contentEditable={false}`, own state) as a React widget; the bar's presence from attrs. |
| section | yes | shape + widgets | Root variables from attrs and the flow layout. Provides a context to descendants (below). |
| paragraph, heading, code block (text-block) | yes | shape + widgets | Numbering, spacing and language from derived stores, which mirror plugin state. |
| derived-spec (other block types) | if its spec has a hole | shape + widgets | As text-block. |
| table | yes (`tbody`) | shape + widgets, decoration from state | Its colgroup and width come from its first row's cells, not its own tag; also section width, the outline preference. |
| table_row | yes | shape + widgets, decoration from state | Pagination's `released` attribute; provides the exact row height to its cells. |
| table_cell | yes | shape + widgets, decoration from state | Its content is wrapped in `div.cell-exact-content` only when the row's exact height applies (`table-cell-view.tsx:85-91`): a per-node shape, from row attributes, merged rows and pagination. |
| toc, upload_block, image, image_anchored, drawing, floating_box, file, page_number, math, placeholder, counter_node | no editable content | React widget as the shape | Their state stays in the component. math, placeholder and floating_box have content in the schema but draw none. |
| page_break, column_break, horizontal_rule, cross_reference, footnote/endnote anchors | no | a plain shape or a widget | Static or state-derived. |

## What porting them needs

1. **Context from a node view to the views inside it** (the section context, width, columns,
   spanners, direction and line numbers, for images, drawings, floating boxes and tables; the
   text block's id for counters; a row's exact height and the table's merged rows for cells).
   Wordgard's way is `decoratePlots`: given each matching plot, children included, it adds point
   decorations to its descendants: attributes, a replaced shape, or widgets whose value carries
   the parent's data. The cell's `div.cell-exact-content` can't be a wrapper decoration (wrappers
   wrap elements, never the content hole, so it would land outside the `td`): simplest is an
   inner `div` in every cell's base shape, with the clip's style added by
   `Point.attributes(…, {target})` on exact rows, so only attributes change. The table's colgroup, from its rows' cells, is
   the same. Cost: a change inside a plot recomputes that whole plot's decorations, fine for a
   table, linear for a section spanning the document. A React context carrying each node's tag
   (react-wordgard could provide one) would serve React widgets without that cost.
2. **Slots and wrapping by extensions** (`slots.tsx`, `editor/use-merge-nodeviews.ts`): pagination
   and the PDF viewer inject attributes, styles and content before and after a node's root, and
   wrap or replace views with props. In Wordgard each extension adds its own decorations:
   `Tag.attribute` (with `target` for an inner element), `Tag.widget` before or after,
   `Tag.wrapper`; attributes from several decorations merge (`class` and `style` joined), so
   nothing like react-prosemirror's `mergeReactProps` is needed. Their values come from
   pagination's stores: see 3.
3. **External stores driving structure** (pagination, numbering, column spanners, preferences,
   i18n, mode, zoom): widgets subscribe to stores like any React component. Shapes aren't React:
   they're recomputed from editor state (`Tag.shape.derived` tracks the state slots it reads), so
   a store that drives a shape needs a bridge dispatching its value into the state.
4. **Event plumbing:** `useStopEvent` and `useIgnoreMutation` (callout title bar, floating box,
   drawing, anchored image) map to a widget's `propagateEvent` and its ignored mutations; a
   section break's `useEditorEventListener` keydown before the keymap; right-click selecting the
   node; drag handles; node selection from `getPos` (`useWidgetPos`).
5. **Hard in any model:** the floating box's nested sub-editor in a portal; portals for resize
   handles and the move ghost; layout measurement (resize observers, `getBoundingClientRect`).
6. **To check in Wordgard:** where node-level decoration attributes and the selected-node class
   land on a widget shape (drawing and anchored images read `ProseMirror-selectednode`); a node
   with content drawn as a widget without a hole, and search highlights inside it.
