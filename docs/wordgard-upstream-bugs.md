# Wordgard bugs found while building react-wordgard (2026-10-31)

Bugs in Wordgard's own view that react-wordgard's comparison tests ran into. Each says what we do
about it now and what to do once Wordgard fixes it. Checked against `wordgard` 0.6.2 (installed)
and Wordgard's `main` at `08804c9`, where all but the last are still present. None reported
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
