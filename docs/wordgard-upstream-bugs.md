# Wordgard bugs found while building react-wordgard (2026-10-31)

Bugs in Wordgard's own view that react-wordgard's comparison tests ran into, typos in its docs,
and, at the end, requests: Wordgard logic we copy because it isn't reachable. Each says what we do about it now and
what to do once Wordgard changes. Checked against `wordgard` 0.6.2 (installed)
and Wordgard's `main` at `08804c9`, where all but the fourth are still present. Those reported
upstream say so in their heading.

Code that depends on one of these points here: `grep -rn wordgard-upstream-bugs src`.

## 1. An inline atom gets a stray buffer after it [reported 03-11, with #115]

- **Repro:** an inline plot whose shape has no content hole, e.g.
`Plot.define("InlineAtom", {inline: true, inlineContent: true, shape: {structure: Elt.mk("span", {class: "atom"}), atom: true}})`.
`<p>a<span class="atom">x</span>b</p>` draws
`<p>a<span class="atom" contenteditable="false"></span><img class="wg-buffer">b</p>`.
- **Cause:** `DecoIterator.walk`'s `enterPlot` (`src/editor/decoration.ts`) emits the inline
plot's `Start` widgets (the `wg-buffer` image) after drawing the node, atom or not. For an atom
it then doesn't enter, so no `End` buffer follows and the start one lands in the parent, after
the atom and outside its wrappers. Real inline plots get both buffers inside themselves.
- **What we do:** mirror it. `iterDeco` (`src/decorations/iterDeco.ts`) pushes a `buffer` view
after an inline atom. The "inline atoms" document in `src/__tests__/tile.browser.test.ts`
compares with Wordgard and pins the markup.
- **Once fixed:** drop the mirror in `iterDeco`, follow whatever Wordgard draws instead (likely no
buffer), and update the pinned markup.

## 2. `enterSpanning` leaves the points it moves in the parent [reported 03-11, #114]

- **Repro:** a spanning wrapper continuing over a point tile. With a spanning mark inline plots can
take (`Mark.define("Highlight", {shape: {element: "mark"}, target: Node.Group.Inline})`),
`<p><mark>a<span class="atom">x</span>b</mark></p>` draws
`<p><mark>a<span class="atom" contenteditable="false"></span>b</mark><img class="wg-buffer"></p>`.
Point widgets between two runs of a spanning mark do the same.
- **Cause:** `ContentUpdate.enterSpanning` (`src/editor/tile.ts`) means to "move any point tiles
after the wrapper into it", but adds them to the wrapper with `addChild` without removing them
from the parent's children. The tile ends up in both, its `parent` is the wrapper, and the
parent's `syncChildren` (which runs after the wrapper's) moves its DOM back out, after the
wrapper. Wordgard's test "doesn't break spanning wrappers on widgets" only counts the wrappers,
so it passes.
- **What we do:** not mirrored, since that would need one tile in two parents. React draws what
Wordgard means: the point inside the wrapper (`openWrapper` in `iterDeco` moves it). The test
"moves the points a spanning wrapper continues over into it" pins it, outside the comparisons.
- **Once fixed:** move that document into the compared ones in `tile.browser.test.ts`; the
dedicated test can go.

## 3. Reusing a wrapper skips some attribute updates [reported 03-11, #112]

- **Repro:** text with a `style` attribute mark (e.g. `Color`), then an update adding an attribute
mark whose attribute sorts before `style` (`class`, `data-*`). Wordgard reuses the span and
leaves the new attribute out of the DOM; its fresh render has it.
- **Cause:** `Attributes.compare` (`src/doc/shape.ts`) returns early with score 0 when `b` has a
name sorting before `a`'s current one, so `TilePointer.matchingWrapper` (`src/editor/tile.ts`)
takes the wrapper as unchanged and skips `updateAttributes`.
- **What we do:** nothing: React's output is right. A comparison test hitting this fails on
Wordgard's side, so the edit sequences avoid it.
- **Once fixed:** an edit adding such an attribute can join the edit sequence in
`tile.browser.test.ts`.

## 4. Empty text leaves (fixed upstream, not released)

- **Repro:** clearing a composition's text, or `insertText` with an empty string, left
`Leaf.Text("")` in the document (Wordgard issue #107).
- **Fixed in:** `08804c9` ("Be more careful about creating empty text nodes"), after 0.6.2:
`insertText`, native input and input rules no longer insert empty text, and `Leaf.text("")`
throws. `Leaf.Text.of("")` still creates one.
- **What we do:** `iterDeco` skips empty text leaves (with their wrappers) and gives a textblock
holding only those the trailing `<br>`. Wordgard 0.6.2 draws an empty text node instead, so
positions there differ slightly.
- **Once released and installed (**`npm run update-wordgard`**):** the test "draws a textblock holding
only an empty text leaf as an empty one" builds its document with `Leaf.text("")` and will
throw; rebuild it with `Leaf.Text.of("")` or drop it. Keep the guard in `iterDeco` while
`Leaf.Text.of("")` can still produce empty leaves.

## 5. A range set's second layer can hold overlapping ranges

- **Repro:** one range source with three mutually overlapping ranges, e.g. `[1,3]`, `[2,20]`,
`[6,8]`, `[12,14]`, `[13,15]` over `<p>one</p><p>two</p><p>three</p><p>four</p>`: a cursor
seeking to 18 (the last paragraph) misses `[2,20]`.
- **Cause:** `SetBuilder.addRange` (`src/set/range.ts`) checks for overlap against its own layer
only, then calls `this.next.addInner`, which doesn't check: layer 2 can hold overlapping ranges
with an unsorted `to` array, and `Chunk.end` and the binary search in `LayerCursor.goto` assume
it sorted. Wordgard walks forward from a fresh cursor, so its fresh render is right; its
incremental update can hit it when an update section starts inside such a range.
- **What we do:** React lays out one plot at a time, so it seeks. `DecoIterator` (copied) splits
each range set into layers that don't overlap for its cursor (`seekable`, cached per set);
the DecoSet given back to Wordgard is untouched. Test: "overlapping ranges (decorated)".
- **Once fixed:** `seekable` can go.

## 6. Wordgard's incremental update with position-dependent decorations

- **Repro:** not reduced. In an audit's random runs (random documents, random point and range
decorations, edits), Wordgard's incremental update differed from its own fresh render in about
90 of 1,900 steps (point attributes or wrappers dropped, content duplicated), and threw
(`Cannot read properties of null (reading 'isNodeOuter')`, `Missing partial node`, `Moving past end of document` in `addAtomicityChanges`). The last one also reaches the React view, through
the `update` it inherits. Fresh Wordgard threw `isNodeOuter` on some documents with point shapes
or wrappers on nested blockquotes.
- **What we do:** nothing: React's view matched fresh Wordgard everywhere else. Our comparison
tests compare against Wordgard's fresh render, or against short edit sequences.
- **Once fixed:** worth a random comparison suite (React against fresh Wordgard after each edit).

## 7. A non-editable text widget is left editable

- **Repro:** a widget type whose `render` returns a text node, without `editable: true`, e.g.
`Widget.define<string>({render: t => document.createTextNode(t)})` as a point or tag widget.
- **Cause:** `setUneditable` (`src/editor/tile.ts`) wraps a text node in a `<span>` and sets
`contenteditable="false"` on it, but the tile keeps the text node, so the parent's
`syncChildren` moves the text back out and the span is dropped.
- **What we do:** mirror it: `setUneditable` in `src/tile.ts` leaves text nodes alone, which
draws the same DOM. The "tag widgets" document in `tile.browser.test.ts` has one.
- **Once fixed:** wrap the text widget as Wordgard then does (the tile likely holding the span).

## 8. `moveVertically` lands one character off in WebKit (unconfirmed)

- **Repro:** Wordgard's own `webtest-coords.ts > moveVertically > can move between paragraphs`,
on plain Wordgard in Playwright's WebKit on Windows: moving up from position 7 (`t|wo`) gives 1,
not 2. Chromium and Firefox pass.
- **What we do:** skip it in WebKit (`test/skipInBrowser.ts`).
- **Before sending:** check it in Safari; Playwright's WebKit on Windows isn't Safari (fonts,
layout). Not to report until confirmed.

## 9. `Decoration.Mark.shape`'s typing names a type that doesn't exist

- **Repro:** typecheck anything importing `wordgard/editor` without `skipLibCheck`:
`editor.d.ts(196,38): Namespace 'Decoration.Mark' has no exported member 'Type'`. Inside
`namespace Decoration.Mark`, `Mark.Type<V>` resolves to the namespace, not to `wordgard/doc`'s
`Mark`.
- **Cause:** the declaration bundling, not the source. `src/editor/decoration.ts` already imports
`Mark as Mark_` and writes `Mark_.Type<V>`; `rollup-plugin-dts` merges the alias into the plain
`Mark` import of the bundled `editor.d.ts`, where the nested namespace shadows it. Same family as
Wordgard's forum issue #6 (`isTextblock` missing on `Plot`): names reused across nested
namespaces, which the bundled declarations don't keep apart. Replacing namespaces with
`export * as …` modules, suggested there, would avoid it but changes the API; Marijn keeps
namespaces to nest classes.
- **What we do:** nothing; every consumer of Wordgard needs `skipLibCheck` (our README says so).
- **Fix:** keep the alias through the bundling, or import the doc's `Mark` under a name no
namespace in the file uses (e.g. `DocMark`), so merging can't recreate the clash.

## 10. Event handlers are recomputed only when the plugins change

- **Repro:** reconfigure (`GardState.reconfigure`, or `appendConfig`) with different
`Wordgard.domEventHandler`s but the same plugins: `InputState.ensureHandlers` runs only when
`updatePlugins` sees the `editorPlugin` facet change (`editor/editor.ts`, `configChange`), so the
old handlers keep running, and added ones never do.
- **What we do:** `useEditorEventListener`'s extension carries a no-op `Wordgard.Plugin`, so adding
or dropping it is a plugin change (`src/contexts/editorEvents.ts`).
- **Fix:** recompute the handlers when the `eventHandler` or `eventObserver` facets change.

## 11. `Wordgard.label` names the outer element, not the textbox [reported 03-11, #113]

- **Repro:** `Wordgard.label("Document")`, then run axe-core over the editor: it reports
`aria-input-field-name`. The label goes through `Wordgard.editorAttributes`, onto `wg.dom`,
while `role="textbox"` is on `wg.contentDOM`, which stays without a name. Its doc comment says
"the editable element".
- **What we do:** the README and our accessibility test use
`Wordgard.contentAttributes.of({ "aria-label": … })`.
- **Fix:** `contentAttributes` in `label` (`editor/editor.ts`).

## 12. Typing at a block-level cursor goes wrong in Chrome and WebKit (2026-11-01) [reported 03-11, #108]

Expected everywhere: a new default textblock holding the text, between the two blocks. That's what
Firefox does, and what `insertText` does when dispatched directly at the gap, in every browser.

- **Between two blocks with content** (two code blocks, or two plots marked
`cursorBarrier: true`): `<p>before</p><pre>one</pre><pre>two</pre><p>after</p>`, cursor between
the code blocks (13, `Doc`, `wg-cursor-h`), type `h`. Chrome (by hand) and, under Playwright,
Chromium and WebKit: the `h` goes into the block below (`htwo`). Firefox: a paragraph `h`
between them. Same on ReactWordgard.
- **Between two block leaves:** plain Wordgard, `[basicSchema(), figure()]`,
`<p>before</p><figure><img src="…"></figure><figure><img src="…"></figure><p>after</p>`.
Put the cursor between the figures (cursor 9, `Doc`, drawn as `wg-cursor-h`; DOM selection
`wg-content@2`), however it gets there, and type `h`. Same on ReactWordgard.
  - Chrome (by hand): nothing is inserted.
  - Firefox: a paragraph `h` between the figures, as expected.
  - Under Playwright, Chromium 156.0.8078.4 and headless Chrome 156.0.8078.79: `beforeinput` and
  `input` fire and the `h` lands at the document's start (`hbefore`). Not reproduced by hand.
  - Playwright's WebKit on Windows: `keydown` and `keypress` only, no `beforeinput`, nothing
  happens. Likely the same issue; not checked in Safari.

  `Command.dispatch(wg, insertText, {from: 9, to: 9, insert: "x", …})` inserts the paragraph in
  all of them.
- **Cause (likely):** Chromium and WebKit can't hold a caret between two block elements (DOM
selection in `wg-content` itself): they move the edit into the nearest text (the block below, when
it has some) or drop it. Wordgard trusts the browser's input there instead of running
`insertText` itself from the key.
- **What we do:** nothing in the view. `src/__tests__/blockCursor.browser.test.ts` types at both
gaps on Wordgard and ReactWordgard: it passes in Firefox and is expected to fail (`it.fails`) in
Chromium and WebKit, so a fixed Wordgard makes it fail there.
- **Once fixed:** make the test a plain `it` in every browser, then check by hand in Chrome and
Safari (Playwright's key events aren't real typing).
- **Fix:** handle text keys (`keydown`/`keypress`) at a block-level cursor with `insertText`.

## 13. Removing a mark around an inline atom plot throws (2026-11-03) [reported 03-11, #115]

- **Repro:** an inline atom plot as in Wordgard's `test/test-commands.ts`
(`Plot.define("InlineAtom", {inline: true, inlineContent: true, shape: {element: "var", atom: true}})`),
`<p>hello <var>x</var> world</p>`. Add `Strong` over the paragraph's content, then remove it: the
removal throws `Cannot destructure property 'tile' of 'parent' as it is null` in
`TilePointer.walk` (from `ContentUpdate.keepInner`, `DocTile.updateRanges`), and the text stays
drawn bold. After the add, the drawing is already off: two `wg-buffer` images, both before the
atom, between two `<strong>`s. With an inline leaf (`Image`) instead, both steps work.
- **What we do:** nothing; not checked on ReactWordgard yet.
- **Once fixed:** check ReactWordgard draws the same steps as fixed Wordgard.

## 14. Changes out of document order make building a transaction quadratic (2026-11-03)

- **Repro:** `bench/changeOrder/` (`npm run demo`, then open `/bench/changeOrder/`): plain
`[basicSchema(), history()]`, `"<p>Lorem ipsum dolor sit amet.</p>"` repeated, and one transaction
inserting `Leaf.text("x")` at the start of every paragraph. With the changes in descending order,
building it (`wg.state.update({changes})`) takes 1.85 s at 8,000 paragraphs, against 8.5 ms in
ascending order; same document either way.
- **Cause:** `createChangeSet` (`src/doc/change.ts`) builds in one pass while positions ascend;
each change that goes back flushes and starts a change set of its own, composed into the ones
before it.
- **What we do:** every command, extender and correction in Stesura's kit emits its changes in
ascending document order (rule 4 of `stesura/docs/wordgard-migration-plan.md`).
- **Once fixed:** nothing to change; the rule can be relaxed.
- **Fix:** sort plain changes by `from` before building (stable, so equal positions keep their
order), or merge out-of-order runs once instead of composing per change.

## 15. A range wrapper keeps stale attributes after a mark change under it (2026-11-03)

- **Repro:** plain Wordgard, a state field holding a range set with one range decoration
wrapping a word (`Decoration.Range.wrapper`, with a `class`), provided as
`Decoration.Range.source.of((state) => state.field(f))`, the field mapping its set through
`tr.changes`. Text styled with `font-size: 12px` (an attribute mark), then one transaction setting
the font size of all the text to `14px`. The document is right; the wrapper is drawn as
`<span style="…font-size: 12px">` (the old size, its `class` gone) around the new
`font-size: 14px` text. A fresh editor draws it right. Found by the benchmark's plugin pass
(`bench/plugins.ts`, the highlights stand-in; `docs/benchmark-results.md`).
- **Cause:** not traced. Likely the same family as item 3: the reused wrapper takes the merged
attributes of the mark it wrapped instead of its own.
- **What we do:** nothing; react-wordgard draws it right. It bites comments, search and track
changes in Stesura's port, whose decorations are range wrappers.
- **Once fixed:** check ReactWordgard still draws the same as fixed Wordgard.

## 16. An Enter splitting a range wrapper, with a correction in the transaction, doubles it (2026-11-03)

- **Repro:** plain Wordgard, a range wrapper over a paragraph's first word (as in item 15) and a
correction marking every touched paragraph (`Correction.onContent(Paragraph, …)` adding a tag
mark, as `bench/plugins.ts`'s "edited" stand-in). Type inside the word and press Enter there, in
the wrapper: each Enter doubles the wrapper's drawing, 2, 4, 8 … 2,048 wrapper elements by the
11th Enter, and the page crashes at the 12th. The range set holds one range; only the drawing
multiplies. Without the correction, or with the wrapper away from the split, it doesn't happen.
- **Cause:** not traced: the correction's mark change and the split in one change set.
- **What we do:** the benchmark keeps its wrapper on each paragraph's last word. react-wordgard
nests the wrappers instead and overflows the stack at the 11th Enter: it inherits the bad
decoration set, so check after the fix.
- **Once fixed:** the benchmark's highlight can go back on the first word.

## 17. Every transaction costs in proportion to the document (2026-11-03)

- **Repro:** at 5,000 paragraphs, one keystroke on plain Wordgard allocates about 0.4 MB in the
state alone (Chromium's sampling heap profiler; `npm run bench:heap`), against ProseMirror's
172 KB for the whole keystroke.
- **Cause:** each new document is validated against the schema in its constructor, walking every
top-level child (unchanged ones are cached, but the loop and its allocations aren't), and its
child list is rebuilt by pushing one entry at a time.
- **What we do:** nothing.
- **Fix:** validate only the children a change set touched, and copy the unchanged runs of the
child list in slices.

## 18. A change adding a mark the schema lacks is dropped silently (2026-11-03; not a bug)

- **Repro:** `[basicSchema(), figure()]`, a `Figure` leaf at 3:
`{changes: {from: 3, add: ImageSize.of(300)}}` leaves the leaf unchanged, while
`{from: 3, add: ImageAlt.of("alt")}` lands. `ImageSize` is only in the schema with
`imageResizing()`; JSON with the mark throws (`Unrecognized mark ImageSize in JSON`).
`{from: pos}` and `{from: pos, to: pos + 1}` both mark a leaf, as they mark a plot's tag.
- **Cause:** `createChangeSet` skips nodes for which `schema.markAllowed` is false, which is also
false for a mark type missing from the schema.
- **What we do:** marks on leaves are settled: Stesura's image and file data go in leaf tag marks
(rule 2). The kit's tests check that every mark a feature sets is in its schema.
- **Ask:** throw (as JSON does) when a change's mark type isn't in the schema at all, rather
than when it's only not allowed on that node.

## 19. The opening smart quote rules eat the character before the quote (2026-11-03)

- **Repro:** plain `[basicSchema(), InputRule.smartQuotes]`, an empty paragraph, then type
`say "hi"` (insertText with `userEvent: "input.type"`, appenders applied): the document reads
`say“hi”`, the space before the opening quote gone. Same with `'`.
- **Cause:** `openDoubleQuote` and `openSingleQuote` (`src/editor/inputrule.ts`) match
`(?:^|[\s{[(<'"\u2018\u201C])(")$` and apply a string, and `applyString` replaces the whole
match (`match[0]`), the preceding character included, not the quote's group.
- **What we do:** Stesura's kit defines its own quote rules, replacing only the group
(`packages/kit/src/extensions/input-rules`).
- **Fix:** have a string `apply` replace the last group when the expression has one, or use a
lookbehind (`(?<=^|[\s…])"$`) in those two rules.

## 20. `docFromJSON` drops marks on the document silently (2026-11-04) [reported 04-11, issue and forum]

- **Repro:** a mark with `target: Doc` (`Lang`, `validate: "string"`), in a schema with
`basicSchema()`. `schema.docFromJSON({type: "Doc", marks: {Lang: "en"}, content: [{type: "Paragraph"}]})`
loads without an error, and `doc.tag.mark(Lang)` is `undefined`. A mark the document doesn't
allow (`Strong`) is dropped the same way. On a paragraph, the same `Lang` throws (`Mark type Lang
cannot target node Paragraph`).
- **Cause:** `Schema.nodeFromJSON` (`src/doc/schema.ts`) parses and validates the marks into the
tag, then for a document type returns `this.doc(children)`, discarding it. The `Doc` constructor
always uses `schema.docTag` (`src/doc/node.ts`). Change specs can't reach the document's tag
either: a mark change at 0, over the whole document, or from −1 leaves it unchanged.
- **What we do:** Stesura's kit keeps document-level data on a hidden first-child plot,
`DocSettings`, each setting a mark on its tag, with three guards: a Select All handler, an
extender restoring it, and a correction dropping a second one.
- **Asked:** on the forum, whether documents are meant to carry marks; as an issue, that loading
should throw instead of dropping them.
- **Once answered:** if documents can carry marks that changes reach, `DocSettings` and its guards
go.

## 21. A change spec can't remove a set-valued mark (2026-11-04)

- **Repro:** a set-valued mark on paragraphs, `Tags = Mark.Type.define<string[]>("Tags", {target:
Paragraph, set: {compare: (a, b) => (a < b ? -1 : a > b ? 1 : 0)}, shape: {attribute: "data-tags",
value: (v) => v.join(" ")}})`, with `basicSchema()`. After `{changes: {from: 0, add: Tags.of(["a",
"b"])}}`, both `{from: 0, remove: Tags.of(["a"])}` and `{from: 0, remove: Tags.of(["a", "b"])}`
leave the paragraph's `Tags` at `["a", "b"]`. `Tags.of(["a"]).removeFromSet(tag.marks)` gives
`[["b"]]`, as documented.
- **Cause:** `createChangeSet`'s `remove` branch (`src/doc/change.ts`) looks the mark up with
`remove.isInSet(marks)`, which needs the whole value equal, so a subset finds nothing. When the
whole value is given, it then takes `subtractSet(remove.value, has.value)`, the values to remove
that the node *doesn't* have, which is empty, and skips the node.
- **Fix (checked on a patched copy of 0.6.2's dist):** for a set type, look up with
`remove.type.isInSet(marks)` and remove the intersection (`remove.value` filtered to the values
`has.value` holds by `compare`). Both repros then remove; and two `wordgard/collab` clients editing
different entries of one set-valued mark at once (each edit a remove of the old entry and an add
of the new) converge with both edits.
- **What we do:** Stesura keeps its style sheet and list definitions as single-valued marks on its
settings node, so two concurrent edits to different styles keep only one. The kit's collab test
(`packages/kit/src/extensions/document/collab.test.ts`) has the set-valued cases as expected
failures.
- **Once fixed:** those cases pass (flip them from `it.fails`); then `StyleSheet` (pro) and
`ListConfigs` (kit) become set-valued marks of `[id, definition]` entries.

## 22. `Pos.parentAt` loops past the root for any depth but the position's own (2026-11-04)

- **Repro:** with `basicSchema()` and `blockquote()`, a document `Blockquote > Paragraph("hi")`,
`doc.resolve(2)` (depth 2): `parentAt(2)` gives the paragraph; `parentAt(1)` and `parentAt(0)`
throw "Cannot read properties of null (reading 'parent')".
- **Cause:** `parentAt` (`src/doc/pos.ts`) walks `p = p.parent` without decrementing `d`, so
`d == depth` only holds on the first step; a shallower depth walks off the root.
- **Fix:** decrement `d` with each step (`for (let d = this.depth, p = this.parent;; d--, p =
p.parent!)`).
- **What we do:** the kit walks `Pos.Plot.parent` itself (`kit/src/extensions/callout`, its nesting
check).
- **Once fixed:** that walk can use `parentAt`; nothing else depends on it.

## 23. Mapping a range set through a deletion that cuts a range short duplicates the range (2026-11-04)

- **Repro:** with `basicSchema()` and the document `<p>ab</p><p> ab</p><p>ab</p><p>xab</p>`, a
`RangeSet` of one non-inclusive value at `[1, 3]`, mapped through `{ from: 2, to: 3 }` (or
`{ from: 1, to: 2 }`): a cursor walks `1-2` twice. With more ranges only the cut one doubles
(`[1,3]`, `[6,8]` through `{ from: 7, to: 8 }` gives `1-3, 6-7, 6-7`). A deletion outside every
range maps correctly. Afterwards `modify({ add })` on the mapped set adds each new range twice
(`0-1, 0-1, …`), with or without a `replace` or `filter` in the same call.
- **What we do:** the kit's search rebuilds its match set on each change while a query is active:
it walks the mapped set, drops duplicates, emptied ranges and the rescanned blocks' ranges, and
calls `RangeSet.create` (`kit/src/extensions/search`). That's O(matches) a change, not
O(changed blocks).
- **Once fixed:** `map` and `modify({ replace })` per changed textblock, as the kit's resolved
properties do with point sets; the search test "agrees with a fresh scan after splits, joins and
typing" checks it.

## 24. The `wg-buffer` images have no `alt` (2026-11-04)

- **Repro:** any inline plot, or an inline atom (#1): Wordgard draws `<img class="wg-buffer">`
(`Widget.img` in `src/editor/decoration.ts` creates the element and sets only its class). axe
reports `image-alt` (critical) on each: Stesura's e2e a11y audit of a paragraph holding a
placeholder (`e2e/tests/demo/a11y.spec.ts`, "a selected placeholder", on `/wordgard-minimal`).
- **Also:** its theme sets `height` and `vertical-align` but not `display`, so a CSS reset making
images blocks (Tailwind's preflight: `img { display: block }`) breaks the line after every inline
atom. Stesura's demo route sets `img.wg-buffer { display: inline }`.
- **Fix:** `img.alt = ""` (a decorative image), and `display: inline` in the theme.
- **What we do:** react-wordgard mirrors Wordgard's markup (`SeparatorHackView`, compared with
Wordgard's in `tile.browser.test.ts`), so it has the same gap; the a11y test fails on it.
- **Once fixed:** react-wordgard's `SeparatorHackView` follows (`alt=""`) with its pinned markup,
and the demo's `display` override goes.

## Documentation [reported 03-11, #109]

### System guide: Editor State > Transactions

- "The things stored in a selection are:" should read "in a transaction".
- "the time at which the selection was created" (annotations) should read "the transaction".

### Transaction.Spec.sequential

{@link string in https://wordgard.net/docs/ref/#state.Transaction.Spec.sequential

## Requests

### Mapping a position over bare sections

- **What we copy:** `ChangeSet.mapPos(pos, 1, "after")` (`src/doc/change.ts`), as `mapNodePos` in
`src/changes.ts` (about 15 lines, plus a `retagged` flag of our own, for a retag and for leaves
in a replaced range of unchanged length), to carry React keys through an update.
- **Why:** `DocTile.update` receives the change sections, not a `ChangeSet` (Wordgard's own tests
call it with `tr.changes.sections`), and a `ChangeSet` can't be rebuilt from sections: its
constructor is private, and `ChangeSet.create` takes a change description. Calling
`ChangeSet.prototype.mapPos` on a stand-in object would work at runtime, but needs a cast and
leans on internals.
- **Ask:** a public way to map over sections (an exported `mapPos(sections, pos, assoc, track)`,
or a public constructor from sections).
- **Once available:** `mapNodePos` becomes a call to it, keeping only the `retagged` check.

### Choosing the renderer before the first draw

- **What we do:** Wordgard's constructor draws with the module's own `DocTile.create`, so a
subclass's `DocTile` isn't used for the first draw. `ReactWordgard` swaps the base class's
`create` for the length of `super()`: it works, but is fragile.
- **Ask:** the constructor looking up `DocTile` on `this.constructor`, as Wordgard's tests already
redirect it (or a CodeMirror-style `setState`).
- **Once available:** the swap goes.

### A renderer interface

- **What we do:** reach into Wordgard's internals, all typed in `src/wordgardInternals.ts`: the
tile classes (taken from instances, as they aren't exported); `TileFlag` and `Reused`; `docTile`,
`observer.ignore` and `updateRanges`; a copy of `DecoIterator` and `getDecoSet`; the decoration
classes and facets; `Widget.Type`'s internal fields (`inFlow`, `editable`, `render`),
`Widget.br`, `Widget.img` and `Widget.text`; `Plot.Type.shape` and `Leaf.Type.shape`;
`Mark.Type`'s `rank`, `element` and `attribute`; `Elt.addAttrs`, `wrap` and `fill`.
- **Ask:** a supported way to supply the tile producer, with exported tile classes or a builder
for them. Part of it: adopting an existing element as the content element (as ProseMirror's
`EditorView` takes a `mount`), so React could render that element in the app's tree instead of
drawing into it through a portal.
- **Once available:** most of `src/wordgardInternals.ts` goes.

### Typings

- **What we do:** two `@ts-expect-error` for the private constructor, `declare` for the
`@internal` members the `.d.ts` strips.
- **Ask:** a constructor subclasses can call, and the members a view needs in the typings. The
npm tarball also ships a stale `dist/view.d.ts` (the old `EditorState` API).

### `destroy()` and `isDestroyed`

- **What we do:** nothing: an editor's lifetime follows its element (`connectedCallback`,
`disconnectedCallback`), so `WordgardEditor` has no way to end one for good, and code holding an
editor can't tell a dropped one from one briefly out of the page.
- **Ask:** `destroy()` (running the plugins' `remove`) and `isDestroyed`, as ProseMirror's view has.
- **Once available:** `WordgardEditor` could destroy its editor on unmount.

### Drag-and-drop moves inside the editor (a question)

- **What we see:** `drop` reads the slice back from `dataTransfer` even for a drag inside the
editor, so moved nodes are rebuilt from HTML: new objects, which remount their React
components (`mapKeys` keeps keys only for the same node object moved within its parent), and
lose what HTML doesn't carry.
- **Ask:** whether that's deliberate; ProseMirror reuses its own slice (`view.dragging.slice`).
- **Once changed:** a drag within one parent keeps the moved node's components, with no work here.

### A transaction filter (for track changes) [asked on the forum 2026-11-04]

- **What we do:** nothing; Stesura's track changes is parked until there's an answer. An
extender can only add changes: re-inserting deleted content leaves a deletion in the change set,
so everything mapped through it (anchors, decorations, the selection, collab) treats the text as
gone.
- **Ask:** a `Transaction.filter` facet, as CodeMirror's `transactionFilter`: run in
`state.update` before the extenders (so appended transactions are filtered too), able to keep,
replace or drop the transaction, with a `filter: false` opt-out on the spec.
- **Once available:** track changes turns a deletion into a `Deletion` mark and marks insertions
there.

### Probing a command with its handlers

- **What we do:** `Command.dispatch` reads its handlers from a facet that isn't exported, and
calling a `Command.Pure` directly skips them, so a toolbar's enabled state would ignore an
extension's handlers. Stesura's kit registers its pure handlers through a facet of its own too
(`pureHandler` in `@stesura/kit`), and probes those.
- **Ask:** `Command.resolve(state, command, param)`, returning the spec (or `false`) that the
first applying pure handler, or the command, gives, without dispatching.
- **Once available:** the kit's probe facet goes.

### The test helpers as `wordgard/test`

- **What we do:** copy `test/schema.ts` (the builders) into react-wordgard and Stesura's kit.
- **Ask:** publish them as `wordgard/test`.
