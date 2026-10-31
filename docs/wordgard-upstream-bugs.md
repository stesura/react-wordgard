# Wordgard bugs found while building react-wordgard (2026-10-31)

Bugs in Wordgard's own view that react-wordgard's comparison tests ran into, and, at the end,
requests: Wordgard logic we copy because it isn't reachable. Each says what we do about it now and
what to do once Wordgard changes. Checked against `wordgard` 0.6.2 (installed)
and Wordgard's `main` at `08804c9`, where all but the fourth are still present. None reported
upstream yet.

Code that depends on one of these points here: `grep -rn wordgard-upstream-bugs src`.

## 1. An inline atom gets a stray buffer after it

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

## 2. `enterSpanning` leaves the points it moves in the parent

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

## 3. Reusing a wrapper skips some attribute updates

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
- **Once released and installed (`npm run update-wordgard`):** the test "draws a textblock holding
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

- **Repro:** not reduced. In the R4 audit's random runs (random documents, random point and range
  decorations, edits), Wordgard's incremental update differed from its own fresh render in about
  90 of 1,900 steps (point attributes or wrappers dropped, content duplicated), and threw
  (`Cannot read properties of null (reading 'isNodeOuter')`, `Missing partial node`, `Moving past
  end of document` in `addAtomicityChanges`). The last one also reaches the React view, through
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

## Requests

### Mapping a position over bare sections

- **What we copy:** `ChangeSet.mapPos(pos, 1, "after")` (`src/doc/change.ts`), as `mapNodePos` in
  `src/reactKeys.ts` (about 15 lines, plus a `retagged` flag of our own), to carry React keys
  through an update.
- **Why:** `DocTile.update` receives the change sections, not a `ChangeSet` (Wordgard's own tests
  call it with `tr.changes.sections`), and a `ChangeSet` can't be rebuilt from sections: its
  constructor is private, and `ChangeSet.create` takes a change description. Calling
  `ChangeSet.prototype.mapPos` on a stand-in object would work at runtime, but needs a cast and
  leans on internals.
- **Ask:** a public way to map over sections (an exported `mapPos(sections, pos, assoc, track)`,
  or a public constructor from sections).
- **Once available:** `mapNodePos` becomes a call to it, keeping only the `retagged` check.
