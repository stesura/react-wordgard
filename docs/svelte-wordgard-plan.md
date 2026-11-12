# Plan: a Svelte view over Wordgard (svelte-wordgard)

**Status:** not executed (2026-11-12). Audited the same day against Svelte 5.57.3's source and the
repository, nothing run in a browser: option B, Phase 0's table, Phase 3's API and the risks
changed. Branch: to create from `vue-wordgard` once merged.

## Goal

The same product as react-wordgard and vue-wordgard, for Svelte 5: every Wordgard decoration that
takes a shape, a wrapper or a widget, plus marks, can be a Svelte component holding the node's
content, free to re-render around it, with the app's contexts reaching it. A third package,
`packages/svelte` (`@stesura/svelte-wordgard`), on the core as it is (option A below would change
it). Like the Vue plan, a trial: Phase 0 and Phase 2 say whether the rest is worth doing.

## What's different from Vue

The seam exists (`Renderer`, `HostedRenderer`, `RenderedWordgard`, the registrations, the cells),
so there is no Phase 1 refactor. What Svelte changes:

- **Anchors can't be avoided with templates.** Vue's were avoided by drawing lists as an element's
  own children. Svelte 5.57's runtime appends an empty text node to the parent even for a keyed
  `{#each}` that is an element's only child (`blocks/each.js`, `EACH_IS_CONTROLLED`), and `mount()`
  appends one to its target when given no `anchor` (`render.js`). `{#if}`, `{@render}` and a
  component in a template each put a comment, except a component or a static `{@render}` that is
  its fragment's only node, which takes the fragment's anchor (`is_standalone`, the compiler's
  `3-transform/utils.js`); compiled with `hmr`, a component there gets its comment back.
  `<svelte:element>` puts a comment beside its element and, when the element has attributes, an
  attachment or children, an empty text node inside it (`blocks/svelte-element.js`). Any list
  drawn by a Svelte template puts one untiled node in a content element, which Phase 2 of the Vue
  plan showed breaks positions, compositions and `restore` (Wordgard's `sync()` removes untiled
  nodes).
- **No virtual DOM.** Svelte updates the DOM from signals, effect by effect. Nothing to seed like
  Vue's `_vnode`, nothing to reuse like `vnode.memo`; per-node updates should come from the
  reactivity itself.
- **`flushSync()` is public**, and flushes every pending effect of the page, the app's included.
  `flush_sync_in_effect` exists in `errors.js` but nothing calls it in 5.57: a flush from inside an
  effect isn't refused by Svelte.
- **Contexts aren't tied to roots.** `mount(Component, { context })` takes a `Map`, and
  `getAllContexts()` gives a component's: a separate root still reads the app's contexts. Reactivity
  doesn't cross roots any less than inside one.
- **`mount` does more than draw.** It wraps the component in a boundary without `onerror`, which
  rethrows what the component throws, and registers every delegated event on its target and on
  `document` (`render.js`).
- **No attribute fallthrough.** A component spreads what it's given on its root, as in React. An
  attachment (`createAttachmentKey`, `svelte/attachments`) in the spread can register the root, as
  React's `ref` in `nodeProps` does.
- **`set_text` caches the last value it wrote** (`TEXT_CACHE`): it writes the text node when the new
  value differs from that cache, not from the node. Text the browser edited is then rewritten with
  the same string, or left alone. Which matters for `restore` and compositions, where a Svelte
  template draws the document's text: option A only.
- **Async mode is a flag of the whole runtime.** `experimental.async` in the app's compiler options
  sets `async_mode_flag` (`flags/index.js`), which `batch.js` branches on: in such an app the
  library's own effects batch differently too.
- **Libraries ship `.svelte` source**, compiled by the app's Svelte (`@sveltejs/package`), not
  bundles: tsup doesn't build them, and the package's tooling differs from the other two.

## Two ways to draw the document

**A. Svelte templates, anchors given tiles.** The library's components are `.svelte` files, lists
are keyed `{#each}` blocks. The core learns to give each anchor among a content tile's children a
zero-length tile (Vue plan, Risks 1). The anchors: an empty text node ending every content element,
and a comment beside every node's and mark's element (their tags are dynamic: `<svelte:element>`),
between runs of text included. Unknown: what the browser does with them beside text (the caret
landing there, typing, deleting), Wordgard's `setDOMSelection` and `posFromDOM` with zero-length
tiles there, and what a keyed `{#each}` going empty does to the DOM Svelte didn't draw in its
parent (a native widget's). A core change both views would carry.

**B. A DOM renderer of our own, a Svelte root per component.** Nothing Wordgard draws is a Svelte
template. A plain DOM renderer draws the document's lists (a plot's children: text, mark elements,
hack nodes, node views), keyed over the core's `childViewKeys`, and the `Elt` shapes themselves:
nested elements, attributes, classes and styles merged with the node wrappers', namespaces, the
places native widgets and a composition's text node take, the roots the core reads. It is what
Vue's `DefaultNodeView`, `MarkView` and `helpers/props.ts` do with vnodes. A Svelte component (a
shape, wrapper, mark shape, widget) is a root of its own,
`mount(Component, { target, anchor, props, context })`, its contexts its parent's
(`getAllContexts`, the host's at the top), its content element filled by the renderer. The cost is
the renderer (React's and Vue's are the framework's) and a root per component.

A root's siblings land in the parent's content element, so B asks this of the components:

- **Root and content are elements the component writes**, registered by attachments (React's `ref`
  and `contentDOMRef`). Not library components: a `DecorationRoot` or a `NodeContent as="div"`
  would be a `<svelte:element>`, with its comment beside it and its empty text node inside.
- **A root whose tag is known per node** (a heading's `h1` to `h6`) needs `<svelte:element>` at the
  component's root: not solved. To try in Phase 0: mount into a detached holder and move the root
  element into place, the anchors staying in the holder (`mount` listens on `document` for
  elements moved out of their container); the holder is then watched for a root replaced.
- **No `<svelte:boundary>` around a root**: its wrapper component's comment lands in the content.
  Errors are caught around `mount` and `flushSync`.
- **A root that is a block** (`{#if}` at its top) is refused with the existing "must draw one
  element at its root" message, unless the holder works.

Phase 0 decides. Expected: B, if its roots can be mounted without anchors in production, in
development and with HMR; A only if its anchors turn out harmless in all three browsers.

## Phase 0: how Svelte behaves (spike)

Svelte 5.57 in Chromium, Firefox and WebKit (Vitest browser mode). The files are throwaway, except
the checks the chosen design rests on (where anchors go, `flushSync` from an effect, what `mount`
does with its anchor): none of it is API, so they stay as tests in `view-svelte` (Phase 2), run at
every Svelte update. To answer, as the Vue plan's table did:

| Question | Why |
| --- | --- |
| Where does a client-rendered tree put anchors (`{#each}` controlled or not, `{#if}`, `{@render}`, `<svelte:element>` beside and inside its element, a component alone in its fragment or not, `mount` with and without `anchor`)? The same compiled with `dev`, and with `hmr`. Does removing the anchor after `mount` break unmount or updates of a single-element root, HMR's included? | A's cost; B's premise; the dev server against the tests |
| A component mounted into a detached holder, its root moved into the document: its updates, a root replaced (`<svelte:element>`'s tag, `{#if}`), its delegated events (through `document`: after Wordgard's handlers?), unmount | B's roots of a per-node tag, and block roots |
| `mount` from inside another root's attachment or effect: tracking, contexts, and who tears the new root down | B's nested roots |
| Typing, deleting and composing next to an empty text node at the end of a paragraph and next to a comment between text and a mark's element, with the caret set by `Selection` beside them. A keyed `{#each}` going empty beside a native widget's DOM | A's verdict |
| `flushSync(fn)` from inside an effect, a template expression, `$effect.pre`, an event handler: does it commit, and is the tree consistent after? The same with `experimental.async` on | `RefusedUpdate`, as Vue's; Risk 4 |
| Does `flushSync` run the app's own `$effect`s (outside the document) inside the flush? Can one dispatch there? | Vue's Phase 4 audit case: a dispatch mid-flush throws |
| `set_text` after the browser edited the node: same string, different string, during a composition | `restore`, compositions (A) |
| A keyed `{#each}` moving items: are the DOM nodes moved (identity kept)? | node moves, "reparent" tests (A) |
| Without `<svelte:boundary>`, where does an error surface: a component's setup, its effects, a later update of its own, an event handler? With one (A): which does it catch, and what does it leave in the DOM? | `failed` |
| `$state` on Wordgard's objects (proxies, private fields) | everything from Wordgard in `$state.raw` |
| An attachment in a spread on a component's root: when does it run relative to `flushSync` returning? | registering roots inside the flush |
| `mount` and `unmount` of 5,000 roots, with the listeners `mount` registers on each target | Risk 2, before Phase 5 |

**Gate:** A or B chosen, with the reason; for B, how a root of a per-node tag is drawn, or that it
can't be. If neither keeps content elements free of untiled nodes without changing Wordgard, stop.

## Phase 1: the package and its tooling

- `packages/svelte`, `@stesura/svelte-wordgard`, the same layout and file names as Vue's where the
  concept is the same: `SvelteWordgard.ts`, `SvelteDocTile.ts`, `words.ts`,
  `components/nodes/DocNodeView`, `DefaultNodeView`, `marks/MarkView`, `TextNodeView`,
  `TrailingHackView`, `SeparatorHackView`, `decorations/Svelte*Type.ts`, `hooks/`. Runes in
  `.svelte.ts` modules. With B, the node, mark, text and hack views are the DOM renderer's
  functions (`.ts`), not components.
- Build: `svelte-package` (`@sveltejs/package`) in the package's `build`, through turbo; the
  package ships `.svelte` and `.js` with types, its `exports` with a `svelte` condition beside
  `@stesura/source`. `typecheck`: `svelte-check`.
- Vite: `@sveltejs/vite-plugin-svelte` in the root `vite.config.ts` (for the new project only),
  the bench and the demo. No Svelte test in the `unit` project: jsdom's resolves `svelte` to its
  server build.
- Lint and format: `eslint-plugin-svelte`, `prettier-plugin-svelte`; React's hook rules off for
  `packages/svelte`, as for Vue. dependency-cruiser: `svelte-not-to-react`, `svelte-not-to-vue`,
  and the reverse; `svelte` in `core-not-to-frameworks`' pattern, in `core-not-to-views`, in
  `views-through-the-core-entry` and in `no-circular`'s exception; `.svelte` in the resolver's
  extensions (check that it reads `.svelte` files; otherwise the rules cover the `.ts` files only,
  written down).
- Scripts: `release.js` (four packages), `update-wordgard.js` (the peer in every workspace),
  `copy-skill-reference.js` (the Svelte skill's copy).
- Peer: `svelte` `~5.57`, as Vue's, even with no internal imported: what the view relies on is
  behaviour, not API (Risk 6).

**Gate:** `npm run check`, `npm run build` and `npm test` pass with the empty package in place.

## Phase 2: `SvelteWordgard.create`, plain documents — the trial's verdict

- `SvelteDocTile.ts`: the renderer. `commit` sets the root's views and runs `flushSync`; `batch`
  is `flushSync(change)`; `redrawsAll` reads the Svelte node wrappers' facet. A or B's drawing.
  With B, the DOM renderer, per node from the start: a cell's listener draws its node, and a list
  that kept its shape isn't drawn.
- `SvelteWordgard.ts` on `RenderedWordgard`, standalone only.
- A fifth Vitest project, `view-svelte`: Wordgard's copied tests with their editors created as
  `SvelteWordgard`, in the three browsers, with React's pending list (`test/view/skipPending.ts`);
  `test/view-svelte/redirect.test.ts` as Vue's; Phase 0's kept checks.

**Gate:** Wordgard's copied tests pass on `SvelteWordgard`, with no skips beyond
`test/skipInBrowser.ts` and the two "reparent" tests. If they can't without changing Wordgard, stop.

## Phase 3: Svelte widgets, shapes, wrappers and marks

- `createWidgetType`, `createShape`, `createWrapper`, `createMarkShape`, `nodeWrapper`, over the
  core's registrations, the same names as the other two.
- The root: an element the component writes, `nodeProps` spread on it, carrying Wordgard's
  attributes and an attachment registering the element (React's `{...nodeProps}` with its ref). A
  root of the wrong tag logs (`warnElement`). `DecorationRoot`, as a convenience and for a per-node
  tag, only if Phase 0 found how to draw one without anchors (B).
- The content: an element the component writes, marked with an attachment it's given (React's
  `contentDOMRef`); without one, the root. Never `{@render children()}`, which puts a comment in
  the content element, nor a `NodeContent as="div"` (B, above).
- What a wrapper wraps: `<WrappedNode />` among the wrapper's own children, its comment a chrome
  tile. A node wrapper has no element: its `WrappedNode` is its root, with a comment under HMR, so
  how it places the node is Phase 0's (the holder).
- Chrome: anchors in a shape's own structure get chrome tiles (Vue's `addChromeTile` for comments);
  empty text nodes too, if Phase 0 shows Svelte leaves them there.
- A component's own updates commit outside the flush (its own effects): Wordgard's observer sees
  them, and the core's `sortRecords` and shape rebuilds handle them, as for React and Vue. With B,
  a component moving its content element from its own state has the renderer fill the new one from
  the attachment, outside the flush. No `sync.ts` expected: to confirm.
- Roots inside a root (B): a component's content holds other roots, which nothing unmounts with
  it. The renderer unmounts them, children first.
- Errors: with B, caught around `mount` and `flushSync` and reported to `failed`; what a component
  throws in a later update of its own isn't (Phase 0 says where it goes). With A,
  `<svelte:boundary>` per component.
- Port the decoration tests from `packages/vue/src/__tests__/` (`vueShape`, `vueMark`,
  `nodeWrapper`, `decorationRoot`, `decorationHooks`, `stesuraTable`, `accessibility`), with
  `.svelte` components, as users write them.

**Gate:** the ported tests pass; a component updating from its own state, one moving its content
element, one unmounted with Svelte decorations in its content, typing next to chrome holding an
`{#if}`, and a composition inside a Svelte mark behave as in the other two; the document's DOM
holds no untiled node when compiled with `hmr`.

## Phase 4: hosting, composables, demo

- `WordgardEditor` (creates the editor, `setContext`), `WordgardDoc` (draws the element and, once
  mounted, the document, with its own contexts from `getAllContexts`). One per editor; a second
  throws.
- On the server (SvelteKit renders there by default, and the package's `.svelte` files are
  compiled for it): no editor is created, `WordgardDoc` draws its empty element, and the editor
  comes when the page mounts. To confirm with a SvelteKit page.
- Composables, the other two's names: `useWordgard`, `useEditorState` (an object with `current`,
  as `svelte/reactivity`'s), `useEditorField`, `useEditorFieldEntry`, `useEditorEffect`,
  `useEditorLayoutEffect`, `useEditorEventListener`, `useNodePos`, `useIsNodeSelected`,
  `useSelectNode`, `useStopEvent`, `useIgnoreMutation`. Not needed, as for Vue:
  `useEditorEventCallback`, `useEditorStateSelector` (a `$derived`), `useMergedDOMRefs`,
  `WordgardScope`.
- Components outside the document get the state after the flush (Vue's `onPublish`), if Phase 0
  shows `flushSync` running their effects inside it.
- Port `packages/vue/src/__tests__/WordgardEditor.browser.test.ts`.
- `demo/svelte/`, `npm run demo:svelte`: the same decorations and menus, sharing `demo/schema.ts`,
  `demo/main.css` and `demo/doc.ts`; deployed at `/svelte/` by `demo.yml`. Driven on the dev
  server too (HMR on), not only built.

## Phase 5: per-node updates and benchmarks

- With A: a cell per node (`cellOf`), its view in `$state.raw`: `publishCells` sets it inside the
  flush, and only that node's effects are pending when `flushSync` runs.
- With B: per-node updates are Phase 2's. Here, a mounted component's props (`$state.raw`, set
  inside the flush) change only when its node's view does, and the cost of the roots (Risk 2).
- `bench/editors.ts` gets svelte-wordgard, mounted as an app does.

**Gate:** typing in one of 5,000 paragraphs updates that paragraph only, and costs no more than
vue-wordgard.

## Phase 6: docs and release

- svelte-wordgard's README, skill (`packages/svelte/skills/svelte-wordgard/`, its examples
  type-checked with `svelte-check`), changelog, `THIRD_PARTY_LICENSES.txt` (react-prosemirror's
  notice where code is adapted), `LICENSE.txt`; `how-it-works.md` ("Svelte"); the root README;
  `CLAUDE.md` (layout, the `view-svelte` project, the demo); `CONTRIBUTING.md`, `RELEASE.md`.

## Risks

1. **B's renderer is ours**, and more than a keyed list: everything React and Vue draw for
   Wordgard (element shapes, attributes, namespaces, native widgets' places, compositions, a kept
   text node the browser edited). It is where bugs would be. It replaces anchors, which can't be
   avoided.
2. **A root per component** (B): `mount` and `unmount` per shape, wrapper, widget and mark
   component, each registering every delegated event on its target, and each to unmount by hand
   under the root that holds it. The bulk edits (Bold all) mount many: Phase 0 measures it first,
   Phase 5 in the bench.
3. **`flushSync` is global.** Every pending effect of the page runs inside Wordgard's flush.
4. **Svelte's async mode** (`experimental.async`) is the app's choice and changes the runtime for
   the library too. Either Phase 0's `flushSync` rows pass with it on, or the README says the app
   must not enable it. A component suspending inside the flush (`await` in components) is
   unsupported either way.
5. **Three views on Wordgard's internals.** Every `npm run update-wordgard` has three views to keep
   passing; the core stays the only place that knows them.
6. **Behaviour, not API.** Where Svelte puts anchors, `flushSync` from inside an effect (its unused
   error is still in `errors.js`) and what `mount` does with its anchor are in no contract: a
   patch release can change them. Hence the `~` peer and Phase 0's kept tests.
7. **The DOM differs between builds.** With `hmr`, a component alone in its fragment gets a
   comment it doesn't have in production: what passes the tests may fail on the dev server.

## Open points

- Whether to share B's renderer with the core (Vue's lists could use it to drop `drawList`'s
  `vnode.memo`) is for after Phase 5.
- A root of a per-node tag under B (a heading's): if Phase 0 finds no way, such a shape takes a
  component per tag, each writing its own root, and the gate records it as a limit of the Svelte
  view.
