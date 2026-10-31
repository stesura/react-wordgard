# Wordgard 0.6.2: bugs and API requests from building a React view on it

For Marijn Haverbeke, ready to send. Not sent yet. Keep it in step with
`docs/wordgard-upstream-bugs.md` (our own notes: what react-wordgard does about each, and what to
do once it's fixed); re-check against Wordgard's `main` before sending.

---

I'm building react-wordgard, a view that lets React draw Wordgard's documents. It replaces
`DocTile.create`/`update` with a tree React renders, then builds real tiles over React's DOM. Its
tests compare its DOM and tile tree against Wordgard's own view, and that comparison surfaced the
bugs below. Everything was checked on 0.6.2, and all of it is still present on `main` at `08804c9`.

## Bugs

1. **An inline atom gets a stray buffer after it.**
   - Shape: `Plot.define("InlineAtom", {inline: true, inlineContent: true, shape: {structure: Elt.mk("span", {class: "atom"}), atom: true}})`.
   - `<p>a<span class="atom">x</span>b</p>` draws
     `<p>a<span class="atom" contenteditable="false"></span><img class="wg-buffer">b</p>`.
   - Cause: `DecoIterator.walk`'s `enterPlot` emits the inline plot's `Start` widgets after
     drawing the node, atom or not. An atom isn't entered, so no `End` buffer follows, and the
     start buffer lands in the parent.

2. **`ContentUpdate.enterSpanning` leaves the point tiles it moves in the parent.**
   - With `Mark.define("Highlight", {shape: {element: "mark"}, target: Node.Group.Inline})`,
     `<p><mark>a<span class="atom">x</span>b</mark></p>` draws the atom after the `<mark>` instead
     of inside it. Point widgets between two runs of a spanning mark do the same.
   - Cause: the points are added to the wrapper with `addChild` but not removed from the parent's
     children, so the parent's `syncChildren` moves their DOM back out.
   - The test "doesn't break spanning wrappers on widgets" only counts wrappers, so it passes
     anyway.

3. **Reusing a wrapper skips some attribute updates.**
   - Text with a `style` attribute mark (e.g. `Color`), then an edit adding an attribute mark whose
     attribute sorts before `style` (`class`, `data-*`). The new attribute never reaches the DOM; a
     fresh render has it.
   - Cause: `Attributes.compare` returns score 0 early when `b` has a name sorting before `a`'s
     current one, so `TilePointer.matchingWrapper` treats the wrapper as unchanged and skips
     `updateAttributes`.

4. **A range set's second layer can hold overlapping ranges, so seeking misses ranges.**
   - One range source with `[1,3]`, `[2,20]`, `[6,8]`, `[12,14]`, `[13,15]` over
     `<p>one</p><p>two</p><p>three</p><p>four</p>`: a cursor seeking to 18 misses `[2,20]`.
   - Cause: `SetBuilder.addRange` checks overlap against its own layer only, then calls
     `this.next.addInner`, which doesn't check. Layer 2 ends up with an unsorted `to` array, while
     `Chunk.end` and `LayerCursor.goto`'s binary search assume it's sorted.
   - A fresh render walks forward from a fresh cursor and is fine. An incremental update starting
     inside such a range can hit it.

5. **A non-editable text widget is left editable.**
   - `Widget.define<string>({render: t => document.createTextNode(t)})` without `editable: true`.
   - `setUneditable` wraps the text node in a `<span contenteditable="false">`, but the tile keeps
     the text node, so the parent's `syncChildren` takes the text back out and the span is dropped.

6. **The incremental update sometimes differs from a fresh render when decorations depend on
   position.** (Not reduced yet.)
   - In random runs (random documents, point and range decorations, edits), the incremental
     update differed from a fresh render in about 90 of 1,900 steps: point attributes or wrappers
     dropped, content duplicated.
   - Some steps threw: `Cannot read properties of null (reading 'isNodeOuter')`, `Missing partial
     node`, and `Moving past end of document` in `addAtomicityChanges`.
   - A fresh render also threw `isNodeOuter` on some documents with point shapes or wrappers on
     nested blockquotes.
   - I can send the generator if it helps.

## API requests

7. **Map a position over bare change sections.** `DocTile.update` receives `changes.sections`, not
   a `ChangeSet`, and a `ChangeSet` can't be rebuilt from sections. So a view mapping positions in
   its update has to copy `ChangeSet.mapPos`. Could you export a
   `mapPos(sections, pos, assoc, track)`, or a public constructor from sections?

8. **Replace the state without a transaction, or choose the renderer before the first draw.** The
   constructor calls the module's own `DocTile.create`, not `Wordgard.DocTile.create`. A
   replacement renderer can only take over after Wordgard has already drawn the whole document
   once; that's about 40% of our load time on 15,000 paragraphs. Either fix would remove it:
   - the constructor looking up `DocTile` on the class, as the tests already redirect it;
   - a CodeMirror-style `setState`.

9. **A renderer interface.** The minimum that would let a view like ours stop reaching into
   internals. Today we use:
   - the tile classes, taken from instances because they aren't exported;
   - `TileFlag` and `Reused`;
   - `docTile`, `observer.ignore`, and `updateRanges`;
   - a copy of `DecoIterator` and `getDecoSet`;
   - the decoration classes and facets;
   - the `@internal` fields of `Widget.Type` (`inFlow`, `editable`, `render`), and `Widget.br`,
     `Widget.img` and `Widget.text`;
   - `Plot.Type.shape` and `Leaf.Type.shape`;
   - `Mark.Type`'s `rank`, `element` and `attribute`;
   - `Elt.addAttrs`, `wrap` and `fill`.

   A supported way to supply the tile producer, plus exported tile classes or a builder for them,
   would cover most of it. I'm happy to share how the bridge uses each one.

10. **Typings.**
    - The constructor is `private`, so subclassing `Wordgard` needs `@ts-expect-error`.
    - `@internal` members are stripped from the `.d.ts`.
    - The npm tarball ships a stale `dist/view.d.ts` (the old `EditorState` API).

---

## Before sending

- Item 8's "about 40%" is from R2's measurement (Wordgard's draw 0.64 s of a 1.6 s load), in
  React's development build. Re-measure in a production build (R6's baseline).
- The empty-text-leaf bug (`docs/wordgard-upstream-bugs.md`, 4) is left out: fixed in `08804c9`.
