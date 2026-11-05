# Benchmark results: react-wordgard against react-prosemirror (2026-11-05)

react-wordgard against react-prosemirror, and Wordgard against ProseMirror, on documents of 50,
500 and 1,500 paragraphs (about 10, 100 and 300 A4 pages): load, typing, Enter, bolding
everything, and three bulk edits over every paragraph in one transaction (an indent, a Replace
All, the font size of styled text), without plugins and with three stand-in plugins. Method,
versions and machine below, then the Wordgard issues found on the way; full tables at the end.
Run with `npm run bench` (under 4 minutes) and `npm run bench:heap` (under a minute).

## Results

### At 1,500 paragraphs, without plugins

Times in ms; for bulk edits, time / MB allocated during the edit.

| | react-wordgard | Wordgard | react-prosemirror | ProseMirror |
|---|---|---|---|---|
| To first interaction | 97.0 | 70.3 | 715 | 61.0 |
| Keystroke | 0.8 | 0.6 | 26.8 | 0.4 |
| Allocated per keystroke (KB) | 252 | 193 | 2,871 | 49.8 |
| Enter | 1.5 | 1.1 | 28.8 | 0.5 |
| Bold all | 153 | 93.7 | 446 | 85.0 |
| Indent every paragraph | 55.1 / 31.7 | 35.6 / 8.6 | 384 / 588 | 104 / 37.1 |
| Replace All | 87.5 / 54.0 | 57.9 / 9.8 | 412 / 566 | 52.4 / 13.9 |
| Font size of all the text | 121 / 50.2 | 78.3 / 19.3 | 784 / 2,346 | 176 / 86.6 |

### At 1,500 paragraphs, with the stand-in plugins

| | react-wordgard | Wordgard | react-prosemirror | ProseMirror |
|---|---|---|---|---|
| To first interaction | 112 | 78.4 | 754 | 66.3 |
| Keystroke | 0.9 | 0.6 | 28.9 | 0.7 |
| Allocated per keystroke (KB) | 463 | 300 | 2,907 | 74.9 |
| Enter | 1.9 | 1.3 | 29.9 | 0.9 |
| Bold all | 171 | 101 | 483 | 95.8 |
| Indent every paragraph | 75.8 / 43.3 | 47.4 / 12.4 | 489 / 1,114 | 165 / 74.6 |
| Replace All | 113 / 65.8 | 83.8 / 19.8 | 591 / 1,090 | 171 / 55.9 |
| Font size of all the text | 156 / 66.9 | 99.1 / 25.5, drawn wrong | 947 / 2,748 | 244 / 122 |

### Memory held after load

From heap snapshots before and after mounting (`npm run bench:heap`): the JS objects the loaded
editor holds, document included, in MB. The DOM is about the same size in every editor (30 to
33 MB of native objects at 1,500 paragraphs).

| Paragraphs | react-wordgard | Wordgard | react-prosemirror | ProseMirror |
|---|---|---|---|---|
| 50 | 0.7 | 0.2 | 3.7 | 0.2 |
| 500 | 4.6 | 1.1 | 35.2 | 1.5 |
| 1,500 | 13.4 | 2.9 | 103.4 | 4.0 |

### What it shows

**react-wordgard against react-prosemirror**, at 1,500 paragraphs:

- **Load and memory:** first interaction 7.4× sooner (97 against 715 ms), 7.7× less memory held.
- **Typing:** keystroke 34× faster (0.8 against 26.8 ms), Enter 19×, allocating 11× less per
  keystroke. react-prosemirror's keystroke grows with the document (0.3, 2.1, 26.8 ms at 50, 500
  and 1,500 paragraphs); react-wordgard's barely (0.2, 0.5, 0.8 ms).
- **Bulk edits:** bold all 2.9×, indent 7×, Replace All 4.7×, font size 6.5× faster, the font
  size allocating 47× less (50 against 2,346 MB). With the stand-in plugins: 6.5×, 5.2× and 6.1×.

**The React layers:** react-wordgard costs its plain editor 1.4× to first interaction and per
Enter, 1.3× per keystroke, and allocates 1.3× as much per keystroke. react-prosemirror costs
ProseMirror 12× to first interaction, 67× per keystroke and 58× per Enter.

**The engines, Wordgard against ProseMirror:**

- ProseMirror loads and types a little faster (61.0 against 70.3 ms to first interaction, 0.4
  against 0.6 ms a keystroke) and allocates 3.9× less per keystroke (50 against 193 KB):
  Wordgard's per-transaction cost grows with the document (issue 4 below).
- Bulk edits in one transaction: Wordgard 2.9× faster on the indent and 2.2× on the font size,
  allocating 1.4 to 4.5× less; ProseMirror 1.1× faster on Replace All.
- With the stand-in plugins Wordgard is ahead on all three: 3.5× on the indent, 2× on Replace
  All, 2.5× on the font size. Its keystroke stays at 0.6 ms; ProseMirror's goes from 0.4 to 0.7.

**Undo** of every bulk edit restored the loaded document in every editor (the benchmark asserts
it).

**Drawn wrong:** Wordgard's font size with the highlights plugin, at every size, from issue 2
below; react-wordgard draws it right. Everything else was drawn as its document.

## What is compared

| Editor | What it is |
|---|---|
| react-wordgard | Wordgard drawn by React: this repository, at commit `fd82024` plus the benchmark changes |
| Wordgard | Wordgard's own view, no React |
| react-prosemirror | `@handlewithcare/react-prosemirror` from npm: ProseMirror drawn by React, as published |
| ProseMirror | ProseMirror's own view, no React |

The plain editors are the floors: comparing Wordgard with ProseMirror shows what the engines do,
comparing each React view with its plain editor shows what the React layer costs.

Every editor has its history (`prosemirror-history`, `wordgard/history`); react-prosemirror also
has the `reactKeys` plugin it requires. Everything is measured twice: without other plugins, then
with three stand-in plugins (below).

Kept simple on purpose: flat documents (paragraphs directly under the root, no lists, tables or
quotes) and no decorations (no node views, no React shapes, wrappers, marks or widgets).

## Versions

| Package | Version |
|---|---|
| `wordgard` | 0.6.2 |
| `@handlewithcare/react-prosemirror` | 3.2.11 |
| `prosemirror-view` | 1.42.3 (react-prosemirror pins it) |
| `prosemirror-model` | 1.25.12 |
| `prosemirror-state` | 1.4.4 |
| `prosemirror-transform` | 1.12.4 |
| `prosemirror-history` | 1.5.1 |
| `prosemirror-commands` | 1.7.2 |
| `prosemirror-schema-basic` | 1.2.5 |
| `react`, `react-dom` | 18.3.1, production build |
| `vitest`, `@vitest/browser-playwright` | 5.0.5 |
| `playwright` | 1.64.1 |
| Browser | Chromium 156.0.8078.4, headless (Playwright's) |
| Node | 24.15.0 |

## Machine

| | |
|---|---|
| CPU | AMD Ryzen 7 9700X, 8 cores, 16 threads |
| Memory | 32 GB DDR5-4800 (2 × 16 GB) |
| Board | MSI MS-7D75 (desktop) |
| OS | Windows 11 Home, build 26200 |

Absolute times depend on the machine and drift between sessions; compare editors within a run.

## The document

`bench/documents.ts` generates it from a seed, the same for every editor and run:

- 50, 500 and 1,500 paragraphs of 100 words each, about 5 paragraphs to an A4 page: about 10, 100
  and 300 pages.
- 2 to 5 marked runs per paragraph, of 1 to 4 words each: bold, italic, a link or a text colour.
- The search term (`acme`) once per paragraph, inside a marked run in every fourth paragraph, so
  replacing it has to carry the run's marks over.

The font-size edit runs on a second, styled document of the same sizes: every word styled, in 6
runs per paragraph, each with its own font size and colour, as documents imported from Word are.

Both schemas have the same content (`bench/schemas.ts`): paragraphs, headings, bold, italic,
links, a text colour, a font size, a paragraph indent and a paragraph "edited" flag (for a
stand-in plugin). Each side in its idiom:

- ProseMirror: the indent and the flag are paragraph attributes; colour and font size share one
  `textStyle` mark, as tiptap's does.
- Wordgard: the indent and the flag are marks on the paragraph's tag, as its own `Alignment` is;
  colour (its `Color`) and font size are single-value marks.

Each editor parses the same HTML.

## How it's measured

`npm run bench` (`bench/editors.bench.test.ts`): Vitest's browser mode, headless Chromium through
Playwright, React's production build, with `--enable-precise-memory-info` and
`--js-flags=--expose-gc`. Each editor is mounted in a 600 px wide element. The output starts each
pass with a summary table per size, built from the detail tables after it.

**Timing.** `performance.now()` around the operation and a forced layout
(`getBoundingClientRect()`): until the DOM is updated and laid out, not painted. Wordgard draws on
its next frame, so the benchmark flushes it (`wg.flush()`); ProseMirror and react-prosemirror
draw synchronously (react-prosemirror commits with `flushSync`). Operations are dispatched as
transactions: the browser's input handling (`beforeinput` for Wordgard, DOM mutations for
ProseMirror) isn't measured.

**Runs.** Each measurement is the median of 3 runs on fresh editors, the editors interleaved
within each run so drift reaches them all alike. Every editor first loads, types, bolds and runs
each bulk edit once on 20 paragraphs, uncounted, so its code is compiled before it's timed. The
cursor is set in the middle paragraph before load, in every editor.

### Interaction

- **Load:** creating the editor from a parsed state until it's drawn and laid out. Parsing the
  HTML isn't counted.
- **First keystroke:** the first character typed after load.
- **To first interaction:** from the start of load until that first character is drawn.
- **Keystroke:** median of 30, after 5 unmeasured, in the middle paragraph.
- **Allocated per keystroke:** 30 more keystrokes under the sampling heap profiler (below), per
  keystroke. Each keystroke is a transaction, so this is the per-transaction overhead as typing
  pays it, drawing included.
- **Enter:** median of 10, after 5 unmeasured (`splitBlock`, Wordgard's `enter`).
- **Allocated per Enter:** 10 more, the same way.
- **Bold all:** adding and removing bold over the whole document, median of 4.
- **Heap held after load:** the JS heap after a forced garbage collection, after load minus
  before. A rough figure: it reads negative when an earlier editor's memory is released late, so
  `npm run bench:heap`'s snapshots are the ones to read for memory.

### Bulk edits

Three edits over every paragraph, each one transaction on a fresh editor:

- **Indent:** set every paragraph's indent. ProseMirror: `tr.setNodeAttribute` per paragraph.
  Wordgard: `{ from, add: Indent.of(1) }` per paragraph, as its `setAlignment` does.
- **Replace:** replace the search term in every paragraph with a longer text carrying the
  match's marks, as Replace All does. The search is a plain-text scan of each paragraph, the
  same on both sides and timed apart ("of which finding"). ProseMirror: `tr.replace(from, to,
  slice)` per match, last first, as prosemirror-search does, with `$from.marksAcross($to)`: the
  match's own marks, less a non-inclusive one (a link) that doesn't go on after it. Wordgard:
  `{ from, to, insert: [Leaf.text(text, marks)] }` per match, with the same marks computed the
  same way. The benchmark checks that every editor draws the same number of replacements inside
  a mark's element.
- **Font size:** set the font size of all the text of the styled document, as Ctrl+A then a size
  does. ProseMirror: `tr.addMark` per run with the run's `textStyle` and the new size merged in,
  a step a run (8,794 at 1,500 paragraphs). Wordgard: one change, `{ from: 0, to: doc.length,
  add: FontSize.of(size) }`; a mark holds one value, so setting it over runs of different sizes
  is one section. Undo has to restore every run's old size on both sides.

ProseMirror's steps go last first, so none moves the positions of the ones after it. Wordgard's
changes in a transaction all count in the document before it, so their order doesn't change the
result, and they go in document order, as Wordgard's own commands give them. Order matters to
Wordgard's speed: `createChangeSet` builds in one pass while positions ascend, and makes each
change that goes back its own change set, composed into the others (issue 1 below).

### With plugins

The second pass adds three stand-ins for an app's plugins (`bench/plugins.ts`), each written as
its editor would have it, to see how what handles a transaction scales with its steps:

| Stand-in | ProseMirror | Wordgard |
|---|---|---|
| Highlights: a decoration on each paragraph's last word (comments, search hits) | A plugin holding a `DecorationSet`, mapped through `tr.mapping` | A state field holding a range set, mapped through `tr.changes`, provided as a range decoration source |
| Anchors: a position per paragraph (bookmarks, comment anchors) | A plugin's array of positions, each mapped through `tr.mapping` | A field's array, each mapped with `tr.changes.mapPos` |
| Edited: every paragraph a transaction touched gets a flag, by a change of its own (ids, numbering, track changes) | `appendTransaction`, setting an attribute per changed paragraph (found by comparing the top-level children) | A `Correction` on paragraph content and marks, adding a mark to the paragraph |

Steps and documents counted are the dispatched transaction's: ProseMirror's appended transaction
(one more step per paragraph, its own documents) and Wordgard's correction (changes in the same
change set) aren't in the counts, only in the time and memory. An undo is an edit too, which the
edited flag marks, so the undo check ignores the flag.

The highlight is on each paragraph's last word, away from where the benchmark types and presses
Enter: on the first word, an Enter inside it crashes the page in Wordgard (issue 3 below).

### Bulk edit columns

- **Steps / changes** (ProseMirror's steps, Wordgard's change set entries) and **Documents
  built**: ProseMirror builds a document per step and keeps them all in the transaction
  (`tr.docs`) until it's applied; Wordgard builds one per transaction.
- **Time:** dispatching it until drawn and laid out, finding included.
- **Allocated:** the bytes allocated during the edit, freed or not: Chromium's sampling heap
  profiler (16 KB interval) with the objects collected by minor and major garbage collections
  included. An estimate, from a separate run on a fresh editor (sampling slows the edit).
- **Heap after, before GC:** the heap right after the edit, minus before. Garbage collections run
  during the edit, so this isn't a peak; the peak isn't observable while the edit blocks the main
  thread.
- **Undo:** one undo, drawn. The benchmark fails if it doesn't restore the loaded document.

An edit an editor draws differently from its document is noted under its table, not failed: a
drawing bug in an editor isn't one in the benchmark. A case projected (from the previous size,
squared) to take over 180 s, or to leave over 2 GB on the heap before garbage collection, is
skipped; none was in this run.

## Wordgard issues found

Found while building the benchmark; minimal repros run in plain Wordgard 0.6.2.

1. **A transaction's changes out of document order make building it quadratic.**
   `createChangeSet` builds in one pass while positions ascend; each change that goes back starts
   a change set of its own, composed into all the others. 8,000 changes in descending order take
   1.85 s to build, in ascending order 8.5 ms, the same document either way
   (`bench/changeOrder/`). Sort a transaction's changes by position.
2. **A range decoration's wrapper keeps its old attributes after a mark change under it.** With a
   range wrapper over a word, setting a font size over the text leaves the wrapper drawn as
   `<span style="…font-size: 12px">` (the old size; its `class` lost) around the new
   `font-size: 14px` text. The document is right; the drawing is stale. react-wordgard draws it
   right.
3. **An Enter splitting a range decoration's wrapper, in a transaction a correction adds to,
   doubles the wrapper's drawing.** With a range wrapper over a paragraph's first word, typing
   inside it and pressing Enter there, with a correction adding a mark to the touched paragraph:
   2, 4, 8 … 2,048 wrapper elements by the 11th Enter, and the page crashes at the 12th. The range
   set holds one range; only the drawing multiplies. Without the correction, or with the wrapper
   away from the split, it doesn't happen. react-wordgard nests the wrappers instead and overflows
   the stack at the 11th Enter.
4. **Every transaction costs in proportion to the document, however small.** Each new document
   is validated against the schema in its constructor, walking every top-level child (unchanged
   ones are cached, but the loop and its allocations aren't), and its child list is rebuilt by
   pushing one entry at a time: about 0.4 MB allocated per transaction at 5,000 paragraphs, state
   alone. Validating only the children a change touched would remove most of it.
5. **A mark added by a change spec doesn't land on a leaf node** (a `Figure`): `{ from, to, add:
   ImageSize.of(300) }` leaves it unchanged; the same marks given in the document's JSON work.
6. **A trap, not a bug: wire a decoration field as one stable source.** Providing a field's
   range set with `Decoration.Range.source.from(field, (set) => () => set)` gives the view a new
   source function each time the set changes, and it redraws every range: with 5,000 ranges,
   about 20 ms and 11 MB allocated per keystroke. `Decoration.Range.source.of((state) =>
   state.field(field))` costs nothing measurable (2.2 ms a keystroke, as without decorations). A
   first run of the plugin pass used the former; the results here use the latter. Issues 2 and 3
   happen with either.

## Fairness, and what this doesn't show

- **Flat documents only.** Every paragraph is a child of the root. Nested structure (lists,
  tables, quotes) isn't measured; react-wordgard's update keeps unchanged ends of a flat list
  without walking them, so a flat document is its best case.
- **No decorations.** Only default nodes are drawn: no node views in react-prosemirror, no React
  shapes, wrappers, marks or widgets in react-wordgard, though drawing those is what react-wordgard
  is for.
- **Stand-in plugins, not an app's.** The plugin pass shows how three kinds of plugin scale with
  steps against change sets; an app's own plugins, node views, React shell and layout aren't here.
- **Each side in its idiom.** Wordgard keeps data like an indent, a flag or a font size as a mark
  holding one value; ProseMirror as an attribute, or, for the text style, one mark holding several
  values. Setting the font size is many steps in ProseMirror and one change in Wordgard because of
  that model, which is part of what's compared.
- **Input handling** isn't measured: transactions are dispatched directly.
- **Memory figures** come from `performance.memory`, heap snapshots and the sampling profiler:
  approximate, and the per-load figure in the timing tables is noisy (above).

## Full results

`npm run bench`, 2026-11-05: React 18.3.1, production build, Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36. Medians of 3 runs (allocations from one more run, sampled). Per run: 30 keystrokes and 10 Enters after 5 unmeasured, then 30 and 10 more sampled for their allocations, 4 bold-all changes (on, off). Bulk edits: one transaction each, timed until drawn; allocations in MB.

### Without plugins

#### 50 paragraphs

| | react-wordgard | Wordgard | react-prosemirror | ProseMirror |
|---|---|---|---|---|
| To first interaction (ms) | 5.4 | 4.2 | 17.4 | 2.8 |
| Keystroke (ms) | 0.2 | 0.1 | 0.3 | 0 |
| Allocated per keystroke (KB) | 49.0 | 20.9 | 194 | 7.1 |
| Enter (ms) | 0.5 | 0.3 | 0.5 | 0.1 |
| Bold all (ms) | 4.6 | 3.3 | 8.3 | 2.6 |
| Indent every paragraph (ms / MB allocated) | 2.7 / 1.2 | 1.7 / 0.3 | 5.7 / 2.6 | 2.8 / 0.3 |
| Replace All (ms / MB allocated) | 3.7 / 1.6 | 2.6 / 0.5 | 6.7 / 2.9 | 1.9 / 0.2 |
| Font size of all the text (ms / MB allocated) | 5.2 / 2.3 | 3.6 / 0.8 | 12.9 / 5.7 | 4.0 / 1.3 |

#### 500 paragraphs

| | react-wordgard | Wordgard | react-prosemirror | ProseMirror |
|---|---|---|---|---|
| To first interaction (ms) | 34.5 | 27.7 | 212 | 20.1 |
| Keystroke (ms) | 0.5 | 0.3 | 2.1 | 0.2 |
| Allocated per keystroke (KB) | 129 | 79.2 | 1148 | 20.1 |
| Enter (ms) | 0.8 | 0.5 | 2.6 | 0.2 |
| Bold all (ms) | 44.8 | 29.1 | 118 | 24.6 |
| Indent every paragraph (ms / MB allocated) | 21.0 / 10.7 | 13.2 / 3.0 | 95.8 / 79.6 | 26.1 / 4.6 |
| Replace All (ms / MB allocated) | 28.9 / 15.5 | 20.0 / 3.4 | 97.6 / 80.4 | 16.8 / 2.9 |
| Font size of all the text (ms / MB allocated) | 53.5 / 17.2 | 34.6 / 7.4 | 236 / 284 | 54.1 / 17.2 |

#### 1,500 paragraphs

| | react-wordgard | Wordgard | react-prosemirror | ProseMirror |
|---|---|---|---|---|
| To first interaction (ms) | 97.0 | 70.3 | 715 | 61.0 |
| Keystroke (ms) | 0.8 | 0.6 | 26.8 | 0.4 |
| Allocated per keystroke (KB) | 252 | 193 | 2871 | 49.8 |
| Enter (ms) | 1.5 | 1.1 | 28.8 | 0.5 |
| Bold all (ms) | 153 | 93.7 | 446 | 85.0 |
| Indent every paragraph (ms / MB allocated) | 55.1 / 31.7 | 35.6 / 8.6 | 384 / 588 | 104 / 37.1 |
| Replace All (ms / MB allocated) | 87.5 / 54.0 | 57.9 / 9.8 | 412 / 566 | 52.4 / 13.9 |
| Font size of all the text (ms / MB allocated) | 121 / 50.2 | 78.3 / 19.3 | 784 / 2346 | 176 / 86.6 |

#### Interaction

| Paragraphs | Editor | Load (ms) | First keystroke (ms) | To first interaction (ms) | Keystroke (ms) | Allocated per keystroke (KB) | Enter (ms) | Allocated per Enter (KB) | Bold all (ms) | Heap held after load (MB) |
|---|---|---|---|---|---|---|---|---|---|---|
| 50 | react-wordgard | 4.9 | 0.5 | 5.4 | 0.2 | 49.0 | 0.5 | 102 | 4.6 | 0.4 |
| 50 | Wordgard | 3.8 | 0.4 | 4.2 | 0.1 | 20.9 | 0.3 | 32.9 | 3.3 | -1.3 |
| 50 | react-prosemirror | 16.0 | 0.9 | 17.4 | 0.3 | 194 | 0.5 | 248 | 8.3 | 3.6 |
| 50 | ProseMirror | 2.5 | 0.3 | 2.8 | 0 | 7.1 | 0.1 | 9.9 | 2.6 | -0.2 |
| 500 | react-wordgard | 32.7 | 1.8 | 34.5 | 0.5 | 129 | 0.8 | 224 | 44.8 | 4.4 |
| 500 | Wordgard | 26.4 | 1.3 | 27.7 | 0.3 | 79.2 | 0.5 | 122 | 29.1 | 0 |
| 500 | react-prosemirror | 196 | 10.8 | 212 | 2.1 | 1148 | 2.6 | 1278 | 118 | 33.9 |
| 500 | ProseMirror | 19.3 | 0.7 | 20.1 | 0.2 | 20.1 | 0.2 | 35.7 | 24.6 | 1.4 |
| 1500 | react-wordgard | 93.3 | 3.7 | 97.0 | 0.8 | 252 | 1.5 | 581 | 153 | 13.2 |
| 1500 | Wordgard | 67.7 | 2.6 | 70.3 | 0.6 | 193 | 1.1 | 277 | 93.7 | 4.8 |
| 1500 | react-prosemirror | 669 | 30.4 | 715 | 26.8 | 2871 | 28.8 | 2969 | 446 | 106 |
| 1500 | ProseMirror | 58.9 | 1.9 | 61.0 | 0.4 | 49.8 | 0.5 | 69.6 | 85.0 | 5.0 |

#### Indent every paragraph

| Paragraphs | Editor | Steps / changes | Documents built | Time (ms) | of which finding (ms) | Allocated (MB) | Heap after, before GC (MB) | Undo (ms) |
|---|---|---|---|---|---|---|---|---|
| 50 | react-wordgard | 50 | 1 | 2.7 | 0 | 1.2 | 1.2 | 2.1 |
| 50 | Wordgard | 50 | 1 | 1.7 | 0 | 0.3 | 0.3 | 1.3 |
| 50 | react-prosemirror | 50 | 50 | 5.7 | 0 | 2.6 | 2.9 | 4.6 |
| 50 | ProseMirror | 50 | 50 | 2.8 | 0 | 0.3 | 0.2 | 2.3 |
| 500 | react-wordgard | 500 | 1 | 21.0 | 0.1 | 10.7 | 11.1 | 17.1 |
| 500 | Wordgard | 500 | 1 | 13.2 | 0 | 3.0 | 3.2 | 10.2 |
| 500 | react-prosemirror | 500 | 500 | 95.8 | 0.1 | 79.6 | 19.0 | 95.8 |
| 500 | ProseMirror | 500 | 500 | 26.1 | 0 | 4.6 | 4.5 | 25.0 |
| 1500 | react-wordgard | 1500 | 1 | 55.1 | 0 | 31.7 | 31.8 | 46.5 |
| 1500 | Wordgard | 1500 | 1 | 35.6 | 0.2 | 8.6 | 8.2 | 28.5 |
| 1500 | react-prosemirror | 1500 | 1500 | 384 | 0.2 | 588 | 50.6 | 371 |
| 1500 | ProseMirror | 1500 | 1500 | 104 | 0.2 | 37.1 | 17.4 | 101 |

#### Replace the search term in every paragraph

Replacements drawn inside a mark's element, the same in every editor: 12 of 50, 116 of 500, 351 of 1500.

| Paragraphs | Editor | Steps / changes | Documents built | Time (ms) | of which finding (ms) | Allocated (MB) | Heap after, before GC (MB) | Undo (ms) |
|---|---|---|---|---|---|---|---|---|
| 50 | react-wordgard | 50 | 1 | 3.7 | 0.1 | 1.6 | 1.5 | 3.0 |
| 50 | Wordgard | 50 | 1 | 2.6 | 0.1 | 0.5 | 0.4 | 2.1 |
| 50 | react-prosemirror | 50 | 50 | 6.7 | 0.1 | 2.9 | 3.0 | 6.4 |
| 50 | ProseMirror | 50 | 50 | 1.9 | 0.1 | 0.2 | 0.2 | 1.5 |
| 500 | react-wordgard | 500 | 1 | 28.9 | 0.8 | 15.5 | 16.1 | 24.4 |
| 500 | Wordgard | 500 | 1 | 20.0 | 0.7 | 3.4 | 3.9 | 16.6 |
| 500 | react-prosemirror | 500 | 500 | 97.6 | 0.7 | 80.4 | 19.2 | 95.1 |
| 500 | ProseMirror | 500 | 500 | 16.8 | 0.5 | 2.9 | 2.9 | 15.1 |
| 1500 | react-wordgard | 1500 | 1 | 87.5 | 1.9 | 54.0 | 29.4 | 77.7 |
| 1500 | Wordgard | 1500 | 1 | 57.9 | 1.6 | 9.8 | 10.4 | 50.5 |
| 1500 | react-prosemirror | 1500 | 1500 | 412 | 1.5 | 566 | 55.0 | 408 |
| 1500 | ProseMirror | 1500 | 1500 | 52.4 | 1.1 | 13.9 | 14.7 | 51.7 |

#### Set the font size of all the text to 14px (styled document: 6 runs a paragraph)

| Paragraphs | Editor | Steps / changes | Documents built | Time (ms) | of which finding (ms) | Allocated (MB) | Heap after, before GC (MB) | Undo (ms) |
|---|---|---|---|---|---|---|---|---|
| 50 | react-wordgard | 1 | 1 | 5.2 | 0 | 2.3 | 2.0 | 4.2 |
| 50 | Wordgard | 1 | 1 | 3.6 | 0 | 0.8 | 0.9 | 3.7 |
| 50 | react-prosemirror | 292 | 292 | 12.9 | 0 | 5.7 | 6.4 | 9.3 |
| 50 | ProseMirror | 292 | 292 | 4.0 | 0 | 1.3 | 1.3 | 3.7 |
| 500 | react-wordgard | 1 | 1 | 53.5 | 0 | 17.2 | 17.5 | 58.0 |
| 500 | Wordgard | 1 | 1 | 34.6 | 0 | 7.4 | 7.4 | 40.5 |
| 500 | react-prosemirror | 2929 | 2929 | 236 | 0.3 | 284 | 35.3 | 236 |
| 500 | ProseMirror | 2929 | 2929 | 54.1 | 0.4 | 17.2 | 17.2 | 64.3 |
| 1500 | react-wordgard | 1 | 1 | 121 | 0 | 50.2 | 26.8 | 135 |
| 1500 | Wordgard | 1 | 1 | 78.3 | 0 | 19.3 | 21.4 | 98.2 |
| 1500 | react-prosemirror | 8794 | 8794 | 784 | 0.4 | 2346 | 113 | 834 |
| 1500 | ProseMirror | 8794 | 8794 | 176 | 0.7 | 86.6 | 75.0 | 237 |

### With the stand-in plugins

#### 50 paragraphs

| | react-wordgard | Wordgard | react-prosemirror | ProseMirror |
|---|---|---|---|---|
| To first interaction (ms) | 5.7 | 4.1 | 19.1 | 3.2 |
| Keystroke (ms) | 0.3 | 0.1 | 0.3 | 0.1 |
| Allocated per keystroke (KB) | 66.5 | 36.8 | 207 | 8.2 |
| Enter (ms) | 0.5 | 0.4 | 0.5 | 0.1 |
| Bold all (ms) | 5.4 | 3.1 | 7.1 | 2.5 |
| Indent every paragraph (ms / MB allocated) | 3.7 / 1.6 | 2.3 / 0.5 | 7.4 / 3.3 | 3.0 / 0.4 |
| Replace All (ms / MB allocated) | 5.5 / 2.1 | 3.6 / 0.9 | 9.4 / 3.7 | 3.8 / 0.6 |
| Font size of all the text (ms / MB allocated) | 6.3 / 2.6 | 5.0 / 0.9 | 14.7 / 7.3 | 4.7 / 1.5 |

#### 500 paragraphs

| | react-wordgard | Wordgard | react-prosemirror | ProseMirror |
|---|---|---|---|---|
| To first interaction (ms) | 39.8 | 27.1 | 238 | 23.3 |
| Keystroke (ms) | 0.5 | 0.4 | 2.6 | 0.2 |
| Allocated per keystroke (KB) | 284 | 200 | 1150 | 31.5 |
| Enter (ms) | 0.9 | 0.7 | 3.3 | 0.3 |
| Bold all (ms) | 52.8 | 30.5 | 129 | 26.8 |
| Indent every paragraph (ms / MB allocated) | 25.1 / 14.8 | 15.1 / 3.7 | 102 / 140 | 34.3 / 8.4 |
| Replace All (ms / MB allocated) | 39.3 / 20.9 | 27.5 / 7.5 | 130 / 140 | 36.8 / 8.0 |
| Font size of all the text (ms / MB allocated) | 50.0 / 22.4 | 34.7 / 8.8 | 206 / 331 | 51.0 / 20.9 |

#### 1,500 paragraphs

| | react-wordgard | Wordgard | react-prosemirror | ProseMirror |
|---|---|---|---|---|
| To first interaction (ms) | 112 | 78.4 | 754 | 66.3 |
| Keystroke (ms) | 0.9 | 0.6 | 28.9 | 0.7 |
| Allocated per keystroke (KB) | 463 | 300 | 2907 | 74.9 |
| Enter (ms) | 1.9 | 1.3 | 29.9 | 0.9 |
| Bold all (ms) | 171 | 101 | 483 | 95.8 |
| Indent every paragraph (ms / MB allocated) | 75.8 / 43.3 | 47.4 / 12.4 | 489 / 1114 | 165 / 74.6 |
| Replace All (ms / MB allocated) | 113 / 65.8 | 83.8 / 19.8 | 591 / 1090 | 171 / 55.9 |
| Font size of all the text (ms / MB allocated) | 156 / 66.9 | 99.1 / 25.5 | 947 / 2748 | 244 / 122 |

#### Interaction

| Paragraphs | Editor | Load (ms) | First keystroke (ms) | To first interaction (ms) | Keystroke (ms) | Allocated per keystroke (KB) | Enter (ms) | Allocated per Enter (KB) | Bold all (ms) | Heap held after load (MB) |
|---|---|---|---|---|---|---|---|---|---|---|
| 50 | react-wordgard | 5.0 | 0.8 | 5.7 | 0.3 | 66.5 | 0.5 | 105 | 5.4 | 0.4 |
| 50 | Wordgard | 3.6 | 0.5 | 4.1 | 0.1 | 36.8 | 0.4 | 62.4 | 3.1 | -1.5 |
| 50 | react-prosemirror | 17.7 | 1.1 | 19.1 | 0.3 | 207 | 0.5 | 239 | 7.1 | 3.6 |
| 50 | ProseMirror | 2.8 | 0.4 | 3.2 | 0.1 | 8.2 | 0.1 | 11.5 | 2.5 | -0.2 |
| 500 | react-wordgard | 37.7 | 2.1 | 39.8 | 0.5 | 284 | 0.9 | 449 | 52.8 | 4.9 |
| 500 | Wordgard | 25.6 | 1.5 | 27.1 | 0.4 | 200 | 0.7 | 206 | 30.5 | 1.7 |
| 500 | react-prosemirror | 218 | 13.2 | 238 | 2.6 | 1150 | 3.3 | 1306 | 129 | 36.9 |
| 500 | ProseMirror | 22.0 | 1.3 | 23.3 | 0.2 | 31.5 | 0.3 | 43.2 | 26.8 | 1.6 |
| 1500 | react-wordgard | 108 | 4.6 | 112 | 0.9 | 463 | 1.9 | 878 | 171 | 14.7 |
| 1500 | Wordgard | 75.0 | 3.4 | 78.4 | 0.6 | 300 | 1.3 | 502 | 101 | -39.1 |
| 1500 | react-prosemirror | 698 | 34.7 | 754 | 28.9 | 2907 | 29.9 | 2975 | 483 | 110 |
| 1500 | ProseMirror | 62.8 | 3.3 | 66.3 | 0.7 | 74.9 | 0.9 | 109 | 95.8 | 5.7 |

#### Indent every paragraph

| Paragraphs | Editor | Steps / changes | Documents built | Time (ms) | of which finding (ms) | Allocated (MB) | Heap after, before GC (MB) | Undo (ms) |
|---|---|---|---|---|---|---|---|---|
| 50 | react-wordgard | 50 | 1 | 3.7 | 0 | 1.6 | 1.7 | 3.3 |
| 50 | Wordgard | 50 | 1 | 2.3 | 0 | 0.5 | 0.5 | 1.6 |
| 50 | react-prosemirror | 50 | 50 | 7.4 | 0 | 3.3 | 3.7 | 5.4 |
| 50 | ProseMirror | 50 | 50 | 3.0 | 0 | 0.4 | 0.3 | 2.5 |
| 500 | react-wordgard | 500 | 1 | 25.1 | 0.1 | 14.8 | 15.1 | 20.4 |
| 500 | Wordgard | 500 | 1 | 15.1 | 0.1 | 3.7 | 4.4 | 12.5 |
| 500 | react-prosemirror | 500 | 500 | 102 | 0.1 | 140 | 18.0 | 115 |
| 500 | ProseMirror | 500 | 500 | 34.3 | 0.1 | 8.4 | 8.2 | 36.5 |
| 1500 | react-wordgard | 1500 | 1 | 75.8 | 0.2 | 43.3 | 12.4 | 62.2 |
| 1500 | Wordgard | 1500 | 1 | 47.4 | 0.2 | 12.4 | 12.5 | 37.2 |
| 1500 | react-prosemirror | 1500 | 1500 | 489 | 0.1 | 1114 | 65.7 | 604 |
| 1500 | ProseMirror | 1500 | 1500 | 165 | 0.2 | 74.6 | 40.0 | 213 |

#### Replace the search term in every paragraph

| Paragraphs | Editor | Steps / changes | Documents built | Time (ms) | of which finding (ms) | Allocated (MB) | Heap after, before GC (MB) | Undo (ms) |
|---|---|---|---|---|---|---|---|---|
| 50 | react-wordgard | 50 | 1 | 5.5 | 0.1 | 2.1 | 2.1 | 4.2 |
| 50 | Wordgard | 50 | 1 | 3.6 | 0.1 | 0.9 | 0.9 | 3.9 |
| 50 | react-prosemirror | 50 | 50 | 9.4 | 0.1 | 3.7 | 4.0 | 7.0 |
| 50 | ProseMirror | 50 | 50 | 3.8 | 0 | 0.6 | 0.5 | 2.5 |
| 500 | react-wordgard | 500 | 1 | 39.3 | 1.0 | 20.9 | 21.6 | 34.0 |
| 500 | Wordgard | 500 | 1 | 27.5 | 0.6 | 7.5 | 7.5 | 24.0 |
| 500 | react-prosemirror | 500 | 500 | 130 | 0.5 | 140 | 19.8 | 145 |
| 500 | ProseMirror | 500 | 500 | 36.8 | 0.4 | 8.0 | 8.4 | 36.8 |
| 1500 | react-wordgard | 1500 | 1 | 113 | 1.9 | 65.8 | 12.4 | 99.4 |
| 1500 | Wordgard | 1500 | 1 | 83.8 | 1.7 | 19.8 | 21.3 | 71.2 |
| 1500 | react-prosemirror | 1500 | 1500 | 591 | 1.4 | 1090 | 55.8 | 691 |
| 1500 | ProseMirror | 1500 | 1500 | 171 | 1.2 | 55.9 | 32.5 | 201 |

#### Set the font size of all the text to 14px (styled document: 6 runs a paragraph)

| Paragraphs | Editor | Steps / changes | Documents built | Time (ms) | of which finding (ms) | Allocated (MB) | Heap after, before GC (MB) | Undo (ms) |
|---|---|---|---|---|---|---|---|---|
| 50 | react-wordgard | 1 | 1 | 6.3 | 0 | 2.6 | 2.5 | 5.6 |
| 50 | Wordgard | 1 | 1 | 5.0 | 0 | 0.9 | 1.1 | 4.6 |
| 50 | react-prosemirror | 292 | 292 | 14.7 | 0 | 7.3 | 7.1 | 12.5 |
| 50 | ProseMirror | 292 | 292 | 4.7 | 0 | 1.5 | 1.4 | 4.8 |
| 500 | react-wordgard | 1 | 1 | 50.0 | 0 | 22.4 | 23.1 | 49.1 |
| 500 | Wordgard | 1 | 1 | 34.7 | 0 | 8.8 | 9.5 | 36.8 |
| 500 | react-prosemirror | 2929 | 2929 | 206 | 0.3 | 331 | 28.7 | 210 |
| 500 | ProseMirror | 2929 | 2929 | 51.0 | 0.4 | 20.9 | 21.4 | 71.1 |
| 1500 | react-wordgard | 1 | 1 | 156 | 0 | 66.9 | 20.4 | 172 |
| 1500 | Wordgard | 1 | 1 | 99.1 | 0 | 25.5 | 26.6 | 125 |
| 1500 | react-prosemirror | 8794 | 8794 | 947 | 0.5 | 2748 | 125 | 1078 |
| 1500 | ProseMirror | 8794 | 8794 | 244 | 0.6 | 122 | 94.1 | 368 |

Drawn differently from the document: Wordgard at 50 paragraphs (50 elements); Wordgard at 500 paragraphs (500 elements); Wordgard at 1500 paragraphs (1500 elements).

### Heap

`npm run bench:heap`, 2026-11-05. Heap snapshots before and after mounting, diffed: the objects each loaded editor holds, document included, by class (constructor name; strings, code and closures by type). Sizes are objects' own (shallow) sizes, not what they retain. Each editor's 12 largest classes are listed.

50 paragraphs: objects held · their own size

| Class | react-wordgard | Wordgard | react-prosemirror | ProseMirror |
|---|---|---|---|---|
| **JS total** | 10,752 · 0.7 MB | 4,288 · 0.2 MB | 107,031 · 3.7 MB | 4,256 · 0.2 MB |
| **DOM (native) total** | 8,697 · 1.1 MB | 7,900 · 1.1 MB | 9,981 · 1.1 MB | 7,436 · 1.0 MB |
| Object | 2,523 · 0.1 MB | 62 · 0.0 MB | 47,371 · 1.3 MB | 333 · 0.0 MB |
| $k (React's FiberNode) | 1,546 · 0.2 MB | 0 · 0.0 MB | 9,573 · 1.0 MB | 0 · 0.0 MB |
| (closure) | 268 · 0.0 MB | 44 · 0.0 MB | 11,965 · 0.3 MB | 41 · 0.0 MB |
| system / Context / scope | 94 · 0.0 MB | 11 · 0.0 MB | 6,529 · 0.2 MB | 27 · 0.0 MB |
| Array | 1,253 · 0.0 MB | 651 · 0.0 MB | 13,915 · 0.2 MB | 871 · 0.0 MB |
| (array) (object elements) | 1,128 · 0.1 MB | 622 · 0.0 MB | 11,629 · 0.2 MB | 465 · 0.0 MB |
| (code) | 761 · 0.1 MB | 267 · 0.1 MB | 963 · 0.2 MB | 173 · 0.0 MB |
| (string) | 663 · 0.1 MB | 528 · 0.0 MB | 1,180 · 0.0 MB | 756 · 0.0 MB |
| (object shape) | 442 · 0.0 MB | 296 · 0.0 MB | 1,345 · 0.0 MB | 161 · 0.0 MB |
| (array) | 24 · 0.0 MB | 15 · 0.0 MB | 108 · 0.0 MB | 0 · 0.0 MB |
| TextViewDesc | 0 · 0.0 MB | 0 · 0.0 MB | 402 · 0.0 MB | 402 · 0.0 MB |
| TextNodeView | 0 · 0.0 MB | 0 · 0.0 MB | 402 · 0.0 MB | 0 · 0.0 MB |
| TextTile | 402 · 0.0 MB | 402 · 0.0 MB | 0 · 0.0 MB | 0 · 0.0 MB |
| TextNode | 0 · 0.0 MB | 0 · 0.0 MB | 402 · 0.0 MB | 402 · 0.0 MB |
| (array) (object properties) | 4 · 0.0 MB | 4 · 0.0 MB | 148 · 0.0 MB | 145 · 0.0 MB |
| Leaf | 402 · 0.0 MB | 402 · 0.0 MB | 0 · 0.0 MB | 0 · 0.0 MB |
| EltTile | 228 · 0.0 MB | 228 · 0.0 MB | 0 · 0.0 MB | 0 · 0.0 MB |
| Widget | 402 · 0.0 MB | 402 · 0.0 MB | 0 · 0.0 MB | 0 · 0.0 MB |
| MarkViewDesc | 0 · 0.0 MB | 0 · 0.0 MB | 0 · 0.0 MB | 178 · 0.0 MB |
| NodeViewDesc | 0 · 0.0 MB | 0 · 0.0 MB | 0 · 0.0 MB | 51 · 0.0 MB |
| Elt | 91 · 0.0 MB | 91 · 0.0 MB | 0 · 0.0 MB | 0 · 0.0 MB |
| Mark | 91 · 0.0 MB | 91 · 0.0 MB | 91 · 0.0 MB | 91 · 0.0 MB |

500 paragraphs: objects held · their own size

| Class | react-wordgard | Wordgard | react-prosemirror | ProseMirror |
|---|---|---|---|---|
| **JS total** | 87,011 · 4.6 MB | 33,116 · 1.1 MB | 1,048,306 · 35.2 MB | 34,201 · 1.5 MB |
| **DOM (native) total** | 79,479 · 10.6 MB | 78,737 · 10.9 MB | 96,406 · 10.6 MB | 74,400 · 10.0 MB |
| Object | 24,232 · 0.6 MB | 61 · 0.0 MB | 470,281 · 13.4 MB | 3,185 · 0.1 MB |
| $k (React's FiberNode) | 15,349 · 1.5 MB | 0 · 0.0 MB | 95,139 · 9.5 MB | 0 · 0.0 MB |
| (closure) | 718 · 0.0 MB | 44 · 0.0 MB | 118,033 · 3.3 MB | 41 · 0.0 MB |
| system / Context / scope | 544 · 0.0 MB | 11 · 0.0 MB | 64,537 · 2.3 MB | 27 · 0.0 MB |
| Array | 11,038 · 0.2 MB | 5,550 · 0.1 MB | 138,046 · 2.2 MB | 8,569 · 0.1 MB |
| (array) (object elements) | 10,106 · 0.6 MB | 5,516 · 0.4 MB | 115,354 · 2.0 MB | 4,551 · 0.4 MB |
| (string) | 5,484 · 0.6 MB | 4,319 · -0.1 MB | 9,965 · 0.3 MB | 3,747 · 0.3 MB |
| (code) | 940 · 0.2 MB | 451 · 0.1 MB | 3,866 · 0.5 MB | 189 · 0.1 MB |
| (array) | 24 · 0.3 MB | 15 · 0.1 MB | 1,008 · 0.4 MB | 0 · 0.0 MB |
| (object shape) | 420 · 0.0 MB | 280 · 0.0 MB | 9,526 · 0.3 MB | 163 · 0.0 MB |
| TextViewDesc | 0 · 0.0 MB | 0 · 0.0 MB | 4,014 · 0.2 MB | 4,014 · 0.2 MB |
| TextNodeView | 0 · 0.0 MB | 0 · 0.0 MB | 4,014 · 0.2 MB | 0 · 0.0 MB |
| TextTile | 4,014 · 0.1 MB | 4,014 · 0.1 MB | 0 · 0.0 MB | 0 · 0.0 MB |
| TextNode | 0 · 0.0 MB | 0 · 0.0 MB | 4,014 · 0.1 MB | 4,014 · 0.1 MB |
| (array) (object properties) | 7 · 0.0 MB | 7 · 0.0 MB | 1,406 · 0.1 MB | 1,403 · 0.1 MB |
| Leaf | 4,014 · 0.1 MB | 4,014 · 0.1 MB | 0 · 0.0 MB | 0 · 0.0 MB |
| EltTile | 2,271 · 0.1 MB | 2,271 · 0.1 MB | 0 · 0.0 MB | 0 · 0.0 MB |
| Widget | 4,014 · 0.1 MB | 4,014 · 0.1 MB | 0 · 0.0 MB | 0 · 0.0 MB |
| MarkViewDesc | 0 · 0.0 MB | 0 · 0.0 MB | 0 · 0.0 MB | 1,771 · 0.1 MB |
| NodeViewDesc | 0 · 0.0 MB | 0 · 0.0 MB | 0 · 0.0 MB | 501 · 0.0 MB |
| DefaultNodeView | 500 · 0.0 MB | 0 · 0.0 MB | 0 · 0.0 MB | 0 · 0.0 MB |
| Elt | 899 · 0.0 MB | 899 · 0.0 MB | 0 · 0.0 MB | 0 · 0.0 MB |
| Mark | 899 · 0.0 MB | 899 · 0.0 MB | 899 · 0.0 MB | 899 · 0.0 MB |
| Plot | 503 · 0.0 MB | 503 · 0.0 MB | 0 · 0.0 MB | 0 · 0.0 MB |

1500 paragraphs: objects held · their own size

| Class | react-wordgard | Wordgard | react-prosemirror | ProseMirror |
|---|---|---|---|---|
| **JS total** | 255,166 · 13.4 MB | 95,525 · 2.9 MB | 3,109,718 · 103.4 MB | 100,115 · 4.0 MB |
| **DOM (native) total** | 234,210 · 31.5 MB | 233,574 · 32.6 MB | 285,450 · 31.6 MB | 224,237 · 30.2 MB |
| Object | 71,890 · 1.9 MB | 61 · 0.0 MB | 1,397,424 · 39.8 MB | 9,409 · 0.2 MB |
| $k (React's FiberNode) | 45,612 · 4.6 MB | 0 · 0.0 MB | 282,765 · 28.3 MB | 0 · 0.0 MB |
| (closure) | 1,718 · 0.0 MB | 44 · 0.0 MB | 350,641 · 9.9 MB | 41 · 0.0 MB |
| system / Context / scope | 1,544 · 0.0 MB | 11 · 0.0 MB | 191,685 · 6.8 MB | 27 · 0.0 MB |
| Array | 32,435 · 0.5 MB | 16,244 · 0.3 MB | 410,001 · 6.6 MB | 25,437 · 0.4 MB |
| (array) (object elements) | 29,751 · 1.8 MB | 16,213 · 1.2 MB | 342,603 · 6.1 MB | 13,497 · 1.0 MB |
| (string) | 17,608 · 1.9 MB | 12,321 · -0.5 MB | 29,407 · 1.0 MB | 10,836 · 0.6 MB |
| (array) | 24 · 1.1 MB | 15 · 0.5 MB | 3,008 · 1.1 MB | 0 · 0.0 MB |
| (object shape) | 416 · 0.0 MB | 278 · 0.0 MB | 27,414 · 0.8 MB | 160 · 0.0 MB |
| TextViewDesc | 0 · 0.0 MB | 0 · 0.0 MB | 11,936 · 0.6 MB | 11,936 · 0.6 MB |
| TextNodeView | 0 · 0.0 MB | 0 · 0.0 MB | 11,936 · 0.5 MB | 0 · 0.0 MB |
| (code) | 424 · 0.1 MB | 628 · 0.1 MB | 7,711 · 0.5 MB | 125 · 0.1 MB |
| TextTile | 11,936 · 0.4 MB | 11,936 · 0.4 MB | 0 · 0.0 MB | 0 · 0.0 MB |
| TextNode | 0 · 0.0 MB | 0 · 0.0 MB | 11,936 · 0.4 MB | 11,936 · 0.4 MB |
| (array) (object properties) | 8 · 0.0 MB | 7 · 0.0 MB | 4,158 · 0.3 MB | 4,155 · 0.3 MB |
| Leaf | 11,936 · 0.3 MB | 11,936 · 0.3 MB | 0 · 0.0 MB | 0 · 0.0 MB |
| EltTile | 6,744 · 0.3 MB | 6,744 · 0.3 MB | 0 · 0.0 MB | 0 · 0.0 MB |
| Widget | 11,936 · 0.2 MB | 11,936 · 0.2 MB | 0 · 0.0 MB | 0 · 0.0 MB |
| MarkViewDesc | 0 · 0.0 MB | 0 · 0.0 MB | 0 · 0.0 MB | 5,244 · 0.2 MB |
| NodeViewDesc | 0 · 0.0 MB | 0 · 0.0 MB | 0 · 0.0 MB | 1,501 · 0.1 MB |
| DefaultNodeView | 1,500 · 0.1 MB | 0 · 0.0 MB | 0 · 0.0 MB | 0 · 0.0 MB |
| Elt | 2,651 · 0.1 MB | 2,651 · 0.1 MB | 0 · 0.0 MB | 0 · 0.0 MB |
| Mark | 2,651 · 0.1 MB | 2,651 · 0.1 MB | 2,651 · 0.1 MB | 2,651 · 0.1 MB |
| Node | 0 · 0.0 MB | 0 · 0.0 MB | 1,501 · 0.0 MB | 1,501 · 0.0 MB |
| Plot | 1,503 · 0.0 MB | 1,503 · 0.0 MB | 0 · 0.0 MB | 0 · 0.0 MB |
