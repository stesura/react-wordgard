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
| To first interaction | 102 | 70.5 | 715 | 61.5 |
| Keystroke | 1.0 | 0.6 | 25.3 | 0.4 |
| Allocated per keystroke (KB) | 272 | 189 | 2,884 | 48.6 |
| Enter | 2.1 | 1.1 | 26.2 | 0.5 |
| Bold all | 155 | 94.3 | 461 | 89.0 |
| Indent every paragraph | 56.6 / 31.3 | 35.5 / 8.2 | 377 / 587 | 106 / 36.9 |
| Replace All | 86.5 / 54.3 | 57.0 / 9.1 | 411 / 571 | 53.2 / 14.5 |
| Font size of all the text | 120 / 52.8 | 77.3 / 20.7 | 791 / 2,346 | 177 / 85.3 |

### At 1,500 paragraphs, with the stand-in plugins

| | react-wordgard | Wordgard | react-prosemirror | ProseMirror |
|---|---|---|---|---|
| To first interaction | 109 | 76.7 | 746 | 64.6 |
| Keystroke | 0.9 | 0.6 | 26.5 | 0.7 |
| Allocated per keystroke (KB) | 441 | 299 | 2,908 | 81.8 |
| Enter | 1.9 | 1.3 | 28.7 | 0.9 |
| Bold all | 171 | 99.7 | 456 | 93.0 |
| Indent every paragraph | 72.9 / 43.2 | 45.6 / 11.6 | 497 / 1,112 | 169 / 75.1 |
| Replace All | 113 / 62.6 | 79.5 / 20.3 | 592 / 1,096 | 168 / 55.7 |
| Font size of all the text | 151 / 66.4 | 93.6 / 25.0, drawn wrong | 921 / 2,748 | 241 / 121 |

### Memory held after load

From heap snapshots before and after mounting (`npm run bench:heap`): the JS objects the loaded
editor holds, document included, in MB. The DOM is about the same size in every editor (30 to
33 MB of native objects at 1,500 paragraphs).

| Paragraphs | react-wordgard | Wordgard | react-prosemirror | ProseMirror |
|---|---|---|---|---|
| 50 | 0.6 | 0.2 | 3.7 | 0.2 |
| 500 | 4.6 | 1.1 | 35.2 | 1.5 |
| 1,500 | 13.4 | 2.9 | 103.3 | 4.0 |

### What it shows

**react-wordgard against react-prosemirror**, at 1,500 paragraphs:

- **Load and memory:** first interaction 7× sooner (102 against 715 ms), 7.7× less memory held.
- **Typing:** keystroke 25× faster (1.0 against 25.3 ms), Enter 12×, allocating 11× less per
  keystroke. react-prosemirror's keystroke grows with the document (0.3, 2.1, 25.3 ms at 50, 500
  and 1,500 paragraphs); react-wordgard's barely (0.2, 0.5, 1.0 ms).
- **Bulk edits:** bold all 3×, indent 6.7×, Replace All 4.8×, font size 6.6× faster, the font
  size allocating 44× less (53 against 2,346 MB). With the stand-in plugins: 6.8×, 5.2× and 6.1×.

**Where react-prosemirror's keystroke goes** (`npm run bench:profile`, 1,500 paragraphs): 26.5 ms
of work, of which 21.9 ms is React's render phase, 20.7 ms of it in `beginWork`'s own code, the
function that bails out of unchanged fibers and passes changed context values down. Each
transaction gives the document's contexts new values, and react-prosemirror holds 283,000 fibers
at that size (190 a paragraph; react-wordgard 30): the time goes into walking that tree, not into
rendering components. The state update, `reactKeys` included, is 1.9 ms; `reactKeys`' rebuilt
tables are most of the 2.9 MB allocated. The time grows faster than the document: per fiber,
about 0.03 µs at 500 paragraphs and 0.09 µs at 1,500, likely as the fiber tree (28 MB) outgrows
the CPU's caches. Not attributed further.

**The React layers:** react-wordgard costs its plain editor 1.4× to first interaction, 1.7× per
keystroke, 1.9× per Enter, and allocates 1.4× as much per keystroke. react-prosemirror costs
ProseMirror 12× to first interaction, 63× per keystroke and 52× per Enter.

**The engines, Wordgard against ProseMirror:**

- ProseMirror loads and types a little faster (61.5 against 70.5 ms to first interaction, 0.4
  against 0.6 ms a keystroke) and allocates 3.9× less per keystroke (49 against 189 KB):
  Wordgard's per-transaction cost grows with the document (issue 4 below).
- Bulk edits in one transaction: Wordgard 3× faster on the indent and 2.3× on the font size,
  allocating 1.6 to 4.5× less; Replace All level (57.0 against 53.2 ms).
- With the stand-in plugins Wordgard is ahead on all three: 3.7× on the indent, 2.1× on Replace
  All, 2.6× on the font size. Its keystroke stays at 0.6 ms; ProseMirror's goes from 0.4 to 0.7.

**Undo** of every bulk edit restored the loaded document in every editor (the benchmark asserts
it).

**Drawn wrong:** Wordgard's font size with the highlights plugin, at every size, from issue 2
below; react-wordgard draws it right. Everything else was drawn as its document.

## Re-run after the package split (2026-11-12)

The repository was split into three packages (`@stesura/wordgard-view`, `@stesura/react-wordgard`,
`@stesura/vue-wordgard`), and vue-wordgard joined the benchmark. Wordgard 0.7.0, React 18.3.1 and
Vue 3.5.45, production builds; same machine, browser and method as above. The question was whether
the split slowed the views; ratios to Wordgard from the same run are compared, since absolute
times drift between sessions.

### At 1,500 paragraphs, without plugins

`npm run bench`, the second of two runs (the first's plugin pass was noisy).

| | react-wordgard | vue-wordgard | Wordgard | react-prosemirror | ProseMirror |
|---|---|---|---|---|---|
| To first interaction | 101 | 113 | 71.2 | 742 | 61.1 |
| Keystroke | 1.0 | 0.8 | 0.6 | 29.5 | 0.4 |
| Allocated per keystroke (KB) | 302 | 266 | 189 | 2,840 | 47.0 |
| Enter | 1.8 | 2.0 | 1.0 | 30.7 | 0.5 |
| Bold all | 153 | 154 | 92.0 | 478 | 92.4 |
| Indent every paragraph | 60.2 / 32.2 | 81.9 / 40.4 | 37.0 / 7.9 | 394 / 586 | 106 / 37.6 |
| Replace All | 95.5 / 52.6 | 99.0 / 41.2 | 66.9 / 10.0 | 459 / 570 | 61.4 / 14.9 |
| Font size of all the text | 129 / 51.8 | 119 / 48.7 | 79.6 / 19.8 | 780 / 2,335 | 174 / 85.1 |

react-wordgard against Wordgard, before the split (the renderer seam's run) → the two runs: load
1.59× → 1.36× / 1.41×, Bold all 1.60× → 1.80× / 1.66×, indent 1.74× → 1.56× / 1.63×, Replace All
1.59× → 1.51× / 1.43×, font size 1.82× → 1.51× / 1.62×.

### At 5,000 paragraphs

`VITE_BENCH_SIZES=5000 VITE_BENCH_EDITORS=react-wordgard,vue-wordgard,Wordgard npm run bench`,
medians of 6 runs, without plugins / with them; times in ms.

| | react-wordgard | vue-wordgard | Wordgard |
|---|---|---|---|
| To first interaction | 430 / 462 | 418 / 437 | 262 / 278 |
| Keystroke | 6.1 / 5.4 | 3.9 / 4.3 | 3.1 / 3.5 |
| Allocated per keystroke (KB) | 871 / 976 | 775 / 892 | 618 / 720 |
| Enter | 8.9 / 9.4 | 8.9 / 9.3 | 5.3 / 5.8 |
| Bold all | 569 / 668 | 569 / 686 | 392 / 479 |
| Indent every paragraph | 287 / 373 | 311 / 409 | 167 / 227 |
| Replace All | 384 / 699 | 415 / 673 | 277 / 532 |
| Font size of all the text | 464 / 692 | 441 / 619 | 298 / 388 |

Allocations per keystroke and per Enter match the run before the split within 3%. Time ratios more
than 10% above that run's were checked: for Enter and the font size it was Wordgard's own time that
moved. First interaction was then run alternately on the commit before the split and on the split,
three times each: react-wordgard/Wordgard 1.55× before and 1.65× after (with plugins 1.85×, then 1.73×),
vue-wordgard/Wordgard 1.45×, then 1.66× (1.64×, then 1.59×). The differences go both ways and are
smaller than the spread between runs.

**Verdict:** no regression from the split.

## What is compared

| Editor | What it is |
|---|---|
| react-wordgard | Wordgard drawn by React: this repository, at commit `cf87906` plus the benchmark changes, mounted as an app does (`<WordgardEditor>` and `<WordgardDoc>` in a React root) |
| Wordgard | Wordgard's own view, no React |
| react-prosemirror | `@handlewithcare/react-prosemirror` from npm: ProseMirror drawn by React, as published, mounted as an app does (`<ProseMirror>` and `<ProseMirrorDoc>` in a React root) |
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
ProseMirror) isn't measured. `performance.now()` ticks at 0.1 ms here (the page isn't
cross-origin isolated): a sub-millisecond keystroke is a few ticks, so between two such figures a
ratio under about 1.5× is within noise.

**Runs.** Each measurement is the median of 3 runs on fresh editors, the editors interleaved
within each run so drift reaches them all alike. Every editor first loads, types, bolds and runs
each bulk edit once on 20 paragraphs, uncounted, so its code is compiled before it's timed. The
cursor is set in the middle paragraph before load, in every editor.

### Interaction

- **Load:** creating the editor from a parsed state until it's drawn and laid out, React's first
  render and each view's own setup included (react-prosemirror's `reactKeys` tables,
  react-wordgard's keys). Parsing the HTML and creating the state aren't counted.
- **First keystroke:** the first character typed after load.
- **To first interaction:** from the start of load until that first character is drawn.
- **Keystroke:** median of 30, after 5 unmeasured, in the middle paragraph.
- **Allocated per keystroke:** 30 more keystrokes under the sampling heap profiler (below), per
  keystroke. Each keystroke is a transaction, so this is the per-transaction overhead as typing
  pays it, drawing included.
- **Enter:** median of 10, after 5 unmeasured (`splitBlock`, Wordgard's `enter`).
- **Allocated per Enter:** 10 more, the same way.
- **Bold all:** adding and removing bold over the whole document, median of 4.

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

- **Flat documents only.** Every paragraph is a child of the root. That is react-wordgard's best
  case (its update keeps the unchanged ends of a flat list without walking them) and
  react-prosemirror's worst (it walks and sorts the document's whole child list on every
  keystroke). Nested structure (lists, tables, quotes) isn't measured, and would narrow the
  difference in time.
- **No decorations.** Only default nodes are drawn: no node views in react-prosemirror, no React
  shapes, wrappers, marks or widgets in react-wordgard, though drawing those is what react-wordgard
  is for.
- **Input handling isn't measured:** transactions are dispatched directly. react-prosemirror
  handles typing itself (`beforeinput`, then a transaction), so its measured path is close to its
  real one. Wordgard lets the browser edit the DOM and reads it back, and react-wordgard then puts
  React's text back before rendering: that work, about one paragraph's, is left out, in their
  favour.
- **Stand-in plugins, not an app's.** The plugin pass shows how three kinds of plugin scale with
  steps against change sets; an app's own plugins, node views, React shell and layout aren't here.
- **Each side in its idiom.** Wordgard keeps data like an indent, a flag or a font size as a mark
  holding one value; ProseMirror as an attribute, or, for the text style, one mark holding several
  values. Setting the font size is many steps in ProseMirror and one change in Wordgard because of
  that model, which is part of what's compared.
- **One browser, one React.** Chromium and React 18's production build only.
- **Memory figures** come from heap snapshots and the sampling profiler (16 KB interval):
  approximate, rough for allocations of a few tens of KB.

## Full results

`npm run bench`, 2026-11-05: React 18.3.1, production build, Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36. Medians of 3 runs (allocations from one more run, sampled). Per run: 30 keystrokes and 10 Enters after 5 unmeasured, then 30 and 10 more sampled for their allocations, 4 bold-all changes (on, off). Bulk edits: one transaction each, timed until drawn; allocations in MB.

### Without plugins

#### 50 paragraphs

| | react-wordgard | Wordgard | react-prosemirror | ProseMirror |
|---|---|---|---|---|
| To first interaction (ms) | 5.7 | 3.4 | 16.4 | 2.6 |
| Keystroke (ms) | 0.2 | 0.1 | 0.3 | 0 |
| Allocated per keystroke (KB) | 50.3 | 17.6 | 189 | 4.9 |
| Enter (ms) | 0.5 | 0.3 | 0.5 | 0.1 |
| Bold all (ms) | 4.8 | 2.9 | 7.5 | 2.5 |
| Indent every paragraph (ms / MB allocated) | 2.9 / 1.1 | 1.9 / 0.3 | 5.5 / 2.7 | 2.8 / 0.2 |
| Replace All (ms / MB allocated) | 4.9 / 1.6 | 2.8 / 0.5 | 6.8 / 2.7 | 1.9 / 0.2 |
| Font size of all the text (ms / MB allocated) | 6.0 / 1.9 | 4.1 / 0.7 | 13.2 / 6.0 | 4.1 / 1.3 |

#### 500 paragraphs

| | react-wordgard | Wordgard | react-prosemirror | ProseMirror |
|---|---|---|---|---|
| To first interaction (ms) | 34.3 | 25.1 | 213 | 20.8 |
| Keystroke (ms) | 0.5 | 0.3 | 2.1 | 0.2 |
| Allocated per keystroke (KB) | 132 | 85.3 | 1146 | 17.2 |
| Enter (ms) | 0.8 | 0.5 | 3.2 | 0.2 |
| Bold all (ms) | 45.8 | 29.7 | 123 | 27.4 |
| Indent every paragraph (ms / MB allocated) | 19.0 / 11.3 | 13.0 / 3.1 | 93.8 / 80.2 | 25.5 / 4.3 |
| Replace All (ms / MB allocated) | 28.6 / 15.8 | 19.9 / 3.2 | 97.1 / 80.2 | 16.3 / 2.5 |
| Font size of all the text (ms / MB allocated) | 40.5 / 16.8 | 25.7 / 7.4 | 162 / 286 | 39.2 / 16.1 |

#### 1,500 paragraphs

| | react-wordgard | Wordgard | react-prosemirror | ProseMirror |
|---|---|---|---|---|
| To first interaction (ms) | 102 | 70.5 | 715 | 61.5 |
| Keystroke (ms) | 1.0 | 0.6 | 25.3 | 0.4 |
| Allocated per keystroke (KB) | 272 | 189 | 2884 | 48.6 |
| Enter (ms) | 2.1 | 1.1 | 26.2 | 0.5 |
| Bold all (ms) | 155 | 94.3 | 461 | 89.0 |
| Indent every paragraph (ms / MB allocated) | 56.6 / 31.3 | 35.5 / 8.2 | 377 / 587 | 106 / 36.9 |
| Replace All (ms / MB allocated) | 86.5 / 54.3 | 57.0 / 9.1 | 411 / 571 | 53.2 / 14.5 |
| Font size of all the text (ms / MB allocated) | 120 / 52.8 | 77.3 / 20.7 | 791 / 2346 | 177 / 85.3 |

#### Interaction

| Paragraphs | Editor | Load (ms) | First keystroke (ms) | To first interaction (ms) | Keystroke (ms) | Allocated per keystroke (KB) | Enter (ms) | Allocated per Enter (KB) | Bold all (ms) |
|---|---|---|---|---|---|---|---|---|---|
| 50 | react-wordgard | 5.1 | 0.5 | 5.7 | 0.2 | 50.3 | 0.5 | 82.2 | 4.8 |
| 50 | Wordgard | 3.1 | 0.4 | 3.4 | 0.1 | 17.6 | 0.3 | 34.6 | 2.9 |
| 50 | react-prosemirror | 15.1 | 0.7 | 16.4 | 0.3 | 189 | 0.5 | 266 | 7.5 |
| 50 | ProseMirror | 2.4 | 0.2 | 2.6 | 0 | 4.9 | 0.1 | 11.5 | 2.5 |
| 500 | react-wordgard | 32.7 | 1.8 | 34.3 | 0.5 | 132 | 0.8 | 220 | 45.8 |
| 500 | Wordgard | 24.0 | 1.0 | 25.1 | 0.3 | 85.3 | 0.5 | 124 | 29.7 |
| 500 | react-prosemirror | 199 | 9.8 | 213 | 2.1 | 1146 | 3.2 | 1295 | 123 |
| 500 | ProseMirror | 19.9 | 0.8 | 20.8 | 0.2 | 17.2 | 0.2 | 25.6 | 27.4 |
| 1500 | react-wordgard | 97.7 | 4.2 | 102 | 1.0 | 272 | 2.1 | 607 | 155 |
| 1500 | Wordgard | 67.9 | 2.7 | 70.5 | 0.6 | 189 | 1.1 | 292 | 94.3 |
| 1500 | react-prosemirror | 670 | 31.0 | 715 | 25.3 | 2884 | 26.2 | 2986 | 461 |
| 1500 | ProseMirror | 59.5 | 2.1 | 61.5 | 0.4 | 48.6 | 0.5 | 69.7 | 89.0 |

#### Indent every paragraph

| Paragraphs | Editor | Steps / changes | Documents built | Time (ms) | of which finding (ms) | Allocated (MB) | Heap after, before GC (MB) | Undo (ms) |
|---|---|---|---|---|---|---|---|---|
| 50 | react-wordgard | 50 | 1 | 2.9 | 0 | 1.1 | 1.2 | 2.5 |
| 50 | Wordgard | 50 | 1 | 1.9 | 0 | 0.3 | 0.3 | 1.3 |
| 50 | react-prosemirror | 50 | 50 | 5.5 | 0 | 2.7 | 2.9 | 4.1 |
| 50 | ProseMirror | 50 | 50 | 2.8 | 0 | 0.2 | 0.2 | 2.2 |
| 500 | react-wordgard | 500 | 1 | 19.0 | 0 | 11.3 | 11.0 | 15.0 |
| 500 | Wordgard | 500 | 1 | 13.0 | 0 | 3.1 | 3.2 | 9.6 |
| 500 | react-prosemirror | 500 | 500 | 93.8 | 0 | 80.2 | 19.0 | 81.9 |
| 500 | ProseMirror | 500 | 500 | 25.5 | 0 | 4.3 | 4.5 | 25.3 |
| 1500 | react-wordgard | 1500 | 1 | 56.6 | 0.1 | 31.3 | 31.7 | 46.0 |
| 1500 | Wordgard | 1500 | 1 | 35.5 | 0.2 | 8.2 | 8.2 | 28.2 |
| 1500 | react-prosemirror | 1500 | 1500 | 377 | 0.1 | 587 | 50.6 | 370 |
| 1500 | ProseMirror | 1500 | 1500 | 106 | 0.3 | 36.9 | 17.4 | 106 |

#### Replace the search term in every paragraph

Replacements drawn inside a mark's element, the same in every editor: 12 of 50, 116 of 500, 351 of 1500.

| Paragraphs | Editor | Steps / changes | Documents built | Time (ms) | of which finding (ms) | Allocated (MB) | Heap after, before GC (MB) | Undo (ms) |
|---|---|---|---|---|---|---|---|---|
| 50 | react-wordgard | 50 | 1 | 4.9 | 0.2 | 1.6 | 1.5 | 3.8 |
| 50 | Wordgard | 50 | 1 | 2.8 | 0.1 | 0.5 | 0.5 | 2.0 |
| 50 | react-prosemirror | 50 | 50 | 6.8 | 0.1 | 2.7 | 3.0 | 5.7 |
| 50 | ProseMirror | 50 | 50 | 1.9 | 0.1 | 0.2 | 0.2 | 1.5 |
| 500 | react-wordgard | 500 | 1 | 28.6 | 0.8 | 15.8 | 16.1 | 23.8 |
| 500 | Wordgard | 500 | 1 | 19.9 | 0.7 | 3.2 | 3.9 | 16.3 |
| 500 | react-prosemirror | 500 | 500 | 97.1 | 0.8 | 80.2 | 19.2 | 96.2 |
| 500 | ProseMirror | 500 | 500 | 16.3 | 0.5 | 2.5 | 2.9 | 14.5 |
| 1500 | react-wordgard | 1500 | 1 | 86.5 | 1.9 | 54.3 | 29.3 | 75.7 |
| 1500 | Wordgard | 1500 | 1 | 57.0 | 1.7 | 9.1 | 10.4 | 50.1 |
| 1500 | react-prosemirror | 1500 | 1500 | 411 | 1.6 | 571 | 55.0 | 407 |
| 1500 | ProseMirror | 1500 | 1500 | 53.2 | 1.1 | 14.5 | 14.7 | 52.4 |

#### Set the font size of all the text to 14px (styled document: 6 runs a paragraph)

| Paragraphs | Editor | Steps / changes | Documents built | Time (ms) | of which finding (ms) | Allocated (MB) | Heap after, before GC (MB) | Undo (ms) |
|---|---|---|---|---|---|---|---|---|
| 50 | react-wordgard | 1 | 1 | 6.0 | 0 | 1.9 | 2.0 | 5.3 |
| 50 | Wordgard | 1 | 1 | 4.1 | 0 | 0.7 | 0.9 | 3.6 |
| 50 | react-prosemirror | 292 | 292 | 13.2 | 0.1 | 6.0 | 6.3 | 11.7 |
| 50 | ProseMirror | 292 | 292 | 4.1 | 0.1 | 1.3 | 1.3 | 5.0 |
| 500 | react-wordgard | 1 | 1 | 40.5 | 0 | 16.8 | 17.4 | 42.2 |
| 500 | Wordgard | 1 | 1 | 25.7 | 0 | 7.4 | 7.4 | 27.8 |
| 500 | react-prosemirror | 2929 | 2929 | 162 | 0.2 | 286 | 35.3 | 174 |
| 500 | ProseMirror | 2929 | 2929 | 39.2 | 0.4 | 16.1 | 17.2 | 50.8 |
| 1500 | react-wordgard | 1 | 1 | 120 | 0 | 52.8 | 26.8 | 134 |
| 1500 | Wordgard | 1 | 1 | 77.3 | 0 | 20.7 | 20.4 | 98.8 |
| 1500 | react-prosemirror | 8794 | 8794 | 791 | 1.1 | 2346 | 113 | 829 |
| 1500 | ProseMirror | 8794 | 8794 | 177 | 0.6 | 85.3 | 75.1 | 238 |

### With the stand-in plugins

#### 50 paragraphs

| | react-wordgard | Wordgard | react-prosemirror | ProseMirror |
|---|---|---|---|---|
| To first interaction (ms) | 6.1 | 4.0 | 17.4 | 3.1 |
| Keystroke (ms) | 0.2 | 0.1 | 0.3 | 0.1 |
| Allocated per keystroke (KB) | 71.9 | 41.0 | 195 | 10.4 |
| Enter (ms) | 0.5 | 0.4 | 0.5 | 0.1 |
| Bold all (ms) | 4.8 | 3.0 | 6.7 | 2.6 |
| Indent every paragraph (ms / MB allocated) | 3.7 / 1.5 | 2.2 / 0.4 | 7.3 / 3.6 | 3.0 / 0.5 |
| Replace All (ms / MB allocated) | 5.1 / 1.6 | 3.3 / 0.8 | 8.9 / 3.9 | 3.4 / 0.5 |
| Font size of all the text (ms / MB allocated) | 5.3 / 2.2 | 3.9 / 1.0 | 11.1 / 7.3 | 4.1 / 1.2 |

#### 500 paragraphs

| | react-wordgard | Wordgard | react-prosemirror | ProseMirror |
|---|---|---|---|---|
| To first interaction (ms) | 35.2 | 27.3 | 225 | 21.7 |
| Keystroke (ms) | 0.5 | 0.3 | 2.4 | 0.2 |
| Allocated per keystroke (KB) | 261 | 199 | 1144 | 27.2 |
| Enter (ms) | 1.0 | 0.7 | 2.8 | 0.3 |
| Bold all (ms) | 48.7 | 30.2 | 124 | 25.0 |
| Indent every paragraph (ms / MB allocated) | 24.1 / 14.4 | 14.2 / 4.3 | 102 / 142 | 33.5 / 8.3 |
| Replace All (ms / MB allocated) | 36.8 / 20.1 | 25.4 / 7.2 | 123 / 141 | 35.9 / 8.1 |
| Font size of all the text (ms / MB allocated) | 48.1 / 22.9 | 31.9 / 9.6 | 199 / 328 | 49.6 / 22.0 |

#### 1,500 paragraphs

| | react-wordgard | Wordgard | react-prosemirror | ProseMirror |
|---|---|---|---|---|
| To first interaction (ms) | 109 | 76.7 | 746 | 64.6 |
| Keystroke (ms) | 0.9 | 0.6 | 26.5 | 0.7 |
| Allocated per keystroke (KB) | 441 | 299 | 2908 | 81.8 |
| Enter (ms) | 1.9 | 1.3 | 28.7 | 0.9 |
| Bold all (ms) | 171 | 99.7 | 456 | 93.0 |
| Indent every paragraph (ms / MB allocated) | 72.9 / 43.2 | 45.6 / 11.6 | 497 / 1112 | 169 / 75.1 |
| Replace All (ms / MB allocated) | 113 / 62.6 | 79.5 / 20.3 | 592 / 1096 | 168 / 55.7 |
| Font size of all the text (ms / MB allocated) | 151 / 66.4 | 93.6 / 25.0 | 921 / 2748 | 241 / 121 |

#### Interaction

| Paragraphs | Editor | Load (ms) | First keystroke (ms) | To first interaction (ms) | Keystroke (ms) | Allocated per keystroke (KB) | Enter (ms) | Allocated per Enter (KB) | Bold all (ms) |
|---|---|---|---|---|---|---|---|---|---|
| 50 | react-wordgard | 5.4 | 0.7 | 6.1 | 0.2 | 71.9 | 0.5 | 100 | 4.8 |
| 50 | Wordgard | 3.5 | 0.5 | 4.0 | 0.1 | 41.0 | 0.4 | 67.3 | 3.0 |
| 50 | react-prosemirror | 16.0 | 1.1 | 17.4 | 0.3 | 195 | 0.5 | 244 | 6.7 |
| 50 | ProseMirror | 2.7 | 0.4 | 3.1 | 0.1 | 10.4 | 0.1 | 4.9 | 2.6 |
| 500 | react-wordgard | 33.2 | 2.0 | 35.2 | 0.5 | 261 | 1.0 | 442 | 48.7 |
| 500 | Wordgard | 25.6 | 1.6 | 27.3 | 0.3 | 199 | 0.7 | 229 | 30.2 |
| 500 | react-prosemirror | 209 | 11.3 | 225 | 2.4 | 1144 | 2.8 | 1301 | 124 |
| 500 | ProseMirror | 20.5 | 1.1 | 21.7 | 0.2 | 27.2 | 0.3 | 38.2 | 25.0 |
| 1500 | react-wordgard | 104 | 4.3 | 109 | 0.9 | 441 | 1.9 | 907 | 171 |
| 1500 | Wordgard | 73.4 | 3.3 | 76.7 | 0.6 | 299 | 1.3 | 477 | 99.7 |
| 1500 | react-prosemirror | 691 | 34.2 | 746 | 26.5 | 2908 | 28.7 | 2966 | 456 |
| 1500 | ProseMirror | 61.3 | 3.2 | 64.6 | 0.7 | 81.8 | 0.9 | 104 | 93.0 |

#### Indent every paragraph

| Paragraphs | Editor | Steps / changes | Documents built | Time (ms) | of which finding (ms) | Allocated (MB) | Heap after, before GC (MB) | Undo (ms) |
|---|---|---|---|---|---|---|---|---|
| 50 | react-wordgard | 50 | 1 | 3.7 | 0 | 1.5 | 1.7 | 2.5 |
| 50 | Wordgard | 50 | 1 | 2.2 | 0 | 0.4 | 0.5 | 1.5 |
| 50 | react-prosemirror | 50 | 50 | 7.3 | 0 | 3.6 | 3.8 | 4.6 |
| 50 | ProseMirror | 50 | 50 | 3.0 | 0 | 0.5 | 0.3 | 2.5 |
| 500 | react-wordgard | 500 | 1 | 24.1 | 0 | 14.4 | 15.0 | 20.4 |
| 500 | Wordgard | 500 | 1 | 14.2 | 0.1 | 4.3 | 4.4 | 11.8 |
| 500 | react-prosemirror | 500 | 500 | 102 | 0.1 | 142 | 18.0 | 111 |
| 500 | ProseMirror | 500 | 500 | 33.5 | 0.1 | 8.3 | 8.2 | 37.6 |
| 1500 | react-wordgard | 1500 | 1 | 72.9 | 0.1 | 43.2 | 12.4 | 59.0 |
| 1500 | Wordgard | 1500 | 1 | 45.6 | 0.1 | 11.6 | 12.5 | 37.1 |
| 1500 | react-prosemirror | 1500 | 1500 | 497 | 0.1 | 1112 | 65.8 | 594 |
| 1500 | ProseMirror | 1500 | 1500 | 169 | 0.2 | 75.1 | 40.0 | 212 |

#### Replace the search term in every paragraph

| Paragraphs | Editor | Steps / changes | Documents built | Time (ms) | of which finding (ms) | Allocated (MB) | Heap after, before GC (MB) | Undo (ms) |
|---|---|---|---|---|---|---|---|---|
| 50 | react-wordgard | 50 | 1 | 5.1 | 0.1 | 1.6 | 2.0 | 4.5 |
| 50 | Wordgard | 50 | 1 | 3.3 | 0.1 | 0.8 | 0.9 | 2.9 |
| 50 | react-prosemirror | 50 | 50 | 8.9 | 0.1 | 3.9 | 4.0 | 6.4 |
| 50 | ProseMirror | 50 | 50 | 3.4 | 0.1 | 0.5 | 0.5 | 2.0 |
| 500 | react-wordgard | 500 | 1 | 36.8 | 0.8 | 20.1 | 21.6 | 32.6 |
| 500 | Wordgard | 500 | 1 | 25.4 | 0.7 | 7.2 | 7.4 | 22.8 |
| 500 | react-prosemirror | 500 | 500 | 123 | 0.6 | 141 | 19.7 | 135 |
| 500 | ProseMirror | 500 | 500 | 35.9 | 0.4 | 8.1 | 8.4 | 34.1 |
| 1500 | react-wordgard | 1500 | 1 | 113 | 1.8 | 62.6 | 12.4 | 98.4 |
| 1500 | Wordgard | 1500 | 1 | 79.5 | 1.7 | 20.3 | 21.0 | 73.2 |
| 1500 | react-prosemirror | 1500 | 1500 | 592 | 1.6 | 1096 | 55.9 | 683 |
| 1500 | ProseMirror | 1500 | 1500 | 168 | 1.1 | 55.7 | 32.4 | 200 |

#### Set the font size of all the text to 14px (styled document: 6 runs a paragraph)

| Paragraphs | Editor | Steps / changes | Documents built | Time (ms) | of which finding (ms) | Allocated (MB) | Heap after, before GC (MB) | Undo (ms) |
|---|---|---|---|---|---|---|---|---|
| 50 | react-wordgard | 1 | 1 | 5.3 | 0 | 2.2 | 2.5 | 4.7 |
| 50 | Wordgard | 1 | 1 | 3.9 | 0 | 1.0 | 1.1 | 3.6 |
| 50 | react-prosemirror | 292 | 292 | 11.1 | 0 | 7.3 | 7.1 | 8.8 |
| 50 | ProseMirror | 292 | 292 | 4.1 | 0.1 | 1.2 | 1.4 | 4.3 |
| 500 | react-wordgard | 1 | 1 | 48.1 | 0 | 22.9 | 23.1 | 54.0 |
| 500 | Wordgard | 1 | 1 | 31.9 | 0 | 9.6 | 9.6 | 35.2 |
| 500 | react-prosemirror | 2929 | 2929 | 199 | 0.4 | 328 | 28.6 | 211 |
| 500 | ProseMirror | 2929 | 2929 | 49.6 | 0.3 | 22.0 | 21.3 | 69.2 |
| 1500 | react-wordgard | 1 | 1 | 151 | 0 | 66.4 | 20.4 | 167 |
| 1500 | Wordgard | 1 | 1 | 93.6 | 0 | 25.0 | 25.6 | 122 |
| 1500 | react-prosemirror | 8794 | 8794 | 921 | 0.7 | 2748 | 125 | 1048 |
| 1500 | ProseMirror | 8794 | 8794 | 241 | 0.7 | 121 | 94.1 | 358 |

Drawn differently from the document: Wordgard at 50 paragraphs (50 elements); Wordgard at 500 paragraphs (500 elements); Wordgard at 1500 paragraphs (1500 elements).

### Heap

`npm run bench:heap`, 2026-11-05. Heap snapshots before and after mounting, diffed: the objects each loaded editor holds, document included, by class (constructor name; strings, code and closures by type). Sizes are objects' own (shallow) sizes, not what they retain. Each editor's 12 largest classes are listed.

50 paragraphs: objects held · their own size

| Class | react-wordgard | Wordgard | react-prosemirror | ProseMirror |
|---|---|---|---|---|
| **JS total** | 11,202 · 0.6 MB | 4,293 · 0.2 MB | 107,048 · 3.7 MB | 4,248 · 0.2 MB |
| **DOM (native) total** | 9,222 · 1.1 MB | 7,900 · 1.1 MB | 9,984 · 1.1 MB | 7,437 · 1.0 MB |
| Object | 2,563 · 0.1 MB | 62 · 0.0 MB | 47,372 · 1.3 MB | 333 · 0.0 MB |
| $k (React's FiberNode) | 1,553 · 0.2 MB | 0 · 0.0 MB | 9,573 · 1.0 MB | 0 · 0.0 MB |
| (closure) | 433 · 0.0 MB | 44 · 0.0 MB | 11,967 · 0.3 MB | 41 · 0.0 MB |
| system / Context / scope | 107 · 0.0 MB | 12 · 0.0 MB | 6,529 · 0.2 MB | 27 · 0.0 MB |
| Array | 1,282 · 0.0 MB | 651 · 0.0 MB | 13,917 · 0.2 MB | 871 · 0.0 MB |
| (array) (object elements) | 1,158 · 0.1 MB | 622 · 0.0 MB | 11,631 · 0.2 MB | 465 · 0.0 MB |
| (code) | 746 · 0.1 MB | 269 · 0.1 MB | 969 · 0.2 MB | 165 · 0.0 MB |
| (string) | 670 · 0.1 MB | 529 · 0.0 MB | 1,179 · 0.0 MB | 756 · 0.0 MB |
| (object shape) | 467 · 0.0 MB | 296 · 0.0 MB | 1,346 · 0.0 MB | 161 · 0.0 MB |
| (array) | 26 · 0.0 MB | 15 · 0.0 MB | 108 · 0.0 MB | 0 · 0.0 MB |
| TextViewDesc | 0 · 0.0 MB | 0 · 0.0 MB | 402 · 0.0 MB | 402 · 0.0 MB |
| TextNodeView | 0 · 0.0 MB | 0 · 0.0 MB | 402 · 0.0 MB | 0 · 0.0 MB |
| TextTile | 402 · 0.0 MB | 402 · 0.0 MB | 0 · 0.0 MB | 0 · 0.0 MB |
| TextNode | 0 · 0.0 MB | 0 · 0.0 MB | 402 · 0.0 MB | 402 · 0.0 MB |
| (array) (object properties) | 6 · 0.0 MB | 4 · 0.0 MB | 149 · 0.0 MB | 145 · 0.0 MB |
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
| **JS total** | 87,451 · 4.6 MB | 33,136 · 1.1 MB | 1,048,251 · 35.2 MB | 34,244 · 1.5 MB |
| **DOM (native) total** | 79,976 · 10.6 MB | 78,755 · 10.9 MB | 96,387 · 10.6 MB | 74,395 · 10.0 MB |
| Object | 24,273 · 0.6 MB | 61 · 0.0 MB | 470,282 · 13.4 MB | 3,185 · 0.1 MB |
| $k (React's FiberNode) | 15,356 · 1.5 MB | 0 · 0.0 MB | 95,139 · 9.5 MB | 0 · 0.0 MB |
| (closure) | 883 · 0.0 MB | 44 · 0.0 MB | 118,035 · 3.3 MB | 41 · 0.0 MB |
| system / Context / scope | 557 · 0.0 MB | 12 · 0.0 MB | 64,537 · 2.3 MB | 27 · 0.0 MB |
| Array | 11,067 · 0.2 MB | 5,550 · 0.1 MB | 138,047 · 2.2 MB | 8,570 · 0.1 MB |
| (array) (object elements) | 10,136 · 0.6 MB | 5,516 · 0.4 MB | 115,355 · 2.0 MB | 4,552 · 0.4 MB |
| (string) | 5,486 · 0.6 MB | 4,318 · -0.1 MB | 9,960 · 0.3 MB | 3,745 · 0.3 MB |
| (code) | 921 · 0.2 MB | 471 · 0.1 MB | 3,810 · 0.5 MB | 234 · 0.1 MB |
| (array) | 26 · 0.3 MB | 15 · 0.1 MB | 1,008 · 0.4 MB | 0 · 0.0 MB |
| (object shape) | 445 · 0.0 MB | 280 · 0.0 MB | 9,528 · 0.3 MB | 163 · 0.0 MB |
| TextViewDesc | 0 · 0.0 MB | 0 · 0.0 MB | 4,014 · 0.2 MB | 4,014 · 0.2 MB |
| TextNodeView | 0 · 0.0 MB | 0 · 0.0 MB | 4,014 · 0.2 MB | 0 · 0.0 MB |
| TextTile | 4,014 · 0.1 MB | 4,014 · 0.1 MB | 0 · 0.0 MB | 0 · 0.0 MB |
| TextNode | 0 · 0.0 MB | 0 · 0.0 MB | 4,014 · 0.1 MB | 4,014 · 0.1 MB |
| (array) (object properties) | 9 · 0.0 MB | 7 · 0.0 MB | 1,407 · 0.1 MB | 1,403 · 0.1 MB |
| Leaf | 4,014 · 0.1 MB | 4,014 · 0.1 MB | 0 · 0.0 MB | 0 · 0.0 MB |
| EltTile | 2,271 · 0.1 MB | 2,271 · 0.1 MB | 0 · 0.0 MB | 0 · 0.0 MB |
| Widget | 4,014 · 0.1 MB | 4,014 · 0.1 MB | 0 · 0.0 MB | 0 · 0.0 MB |
| MarkViewDesc | 0 · 0.0 MB | 0 · 0.0 MB | 0 · 0.0 MB | 1,771 · 0.1 MB |
| NodeViewDesc | 0 · 0.0 MB | 0 · 0.0 MB | 0 · 0.0 MB | 501 · 0.0 MB |
| Elt | 899 · 0.0 MB | 899 · 0.0 MB | 0 · 0.0 MB | 0 · 0.0 MB |
| Mark | 899 · 0.0 MB | 899 · 0.0 MB | 899 · 0.0 MB | 899 · 0.0 MB |
| Plot | 503 · 0.0 MB | 503 · 0.0 MB | 0 · 0.0 MB | 0 · 0.0 MB |

1500 paragraphs: objects held · their own size

| Class | react-wordgard | Wordgard | react-prosemirror | ProseMirror |
|---|---|---|---|---|
| **JS total** | 254,540 · 13.4 MB | 95,473 · 2.9 MB | 3,109,665 · 103.3 MB | 100,113 · 4.0 MB |
| **DOM (native) total** | 234,729 · 31.5 MB | 233,597 · 32.6 MB | 285,455 · 31.6 MB | 224,213 · 30.2 MB |
| Object | 71,929 · 1.9 MB | 61 · 0.0 MB | 1,397,425 · 39.8 MB | 9,409 · 0.2 MB |
| $k (React's FiberNode) | 45,619 · 4.6 MB | 0 · 0.0 MB | 282,765 · 28.3 MB | 0 · 0.0 MB |
| (closure) | 1,883 · 0.1 MB | 44 · 0.0 MB | 350,643 · 9.9 MB | 41 · 0.0 MB |
| system / Context / scope | 1,557 · 0.0 MB | 12 · 0.0 MB | 191,685 · 6.8 MB | 27 · 0.0 MB |
| Array | 32,464 · 0.5 MB | 16,244 · 0.3 MB | 410,003 · 6.6 MB | 25,437 · 0.4 MB |
| (array) (object elements) | 29,781 · 1.8 MB | 16,213 · 1.2 MB | 342,605 · 6.1 MB | 13,497 · 1.0 MB |
| (string) | 16,481 · 1.9 MB | 12,322 · -0.5 MB | 29,409 · 1.0 MB | 10,836 · 0.6 MB |
| (array) | 26 · 1.1 MB | 15 · 0.5 MB | 3,008 · 1.1 MB | 0 · 0.0 MB |
| (object shape) | 427 · 0.0 MB | 278 · 0.0 MB | 27,415 · 0.8 MB | 160 · 0.0 MB |
| TextViewDesc | 0 · 0.0 MB | 0 · 0.0 MB | 11,936 · 0.6 MB | 11,936 · 0.6 MB |
| TextNodeView | 0 · 0.0 MB | 0 · 0.0 MB | 11,936 · 0.5 MB | 0 · 0.0 MB |
| (code) | 485 · 0.1 MB | 574 · 0.1 MB | 7,641 · 0.4 MB | 122 · 0.1 MB |
| TextTile | 11,936 · 0.4 MB | 11,936 · 0.4 MB | 0 · 0.0 MB | 0 · 0.0 MB |
| TextNode | 0 · 0.0 MB | 0 · 0.0 MB | 11,936 · 0.4 MB | 11,936 · 0.4 MB |
| (array) (object properties) | 10 · 0.0 MB | 7 · 0.0 MB | 4,159 · 0.3 MB | 4,155 · 0.3 MB |
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
