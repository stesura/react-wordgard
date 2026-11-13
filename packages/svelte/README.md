# svelte-wordgard

> **Under construction.** svelte-wordgard isn't ready for production yet, and its API may still
> change.

svelte-wordgard stays on 0.x for as long as Wordgard does: it reaches into Wordgard's internals, and
relies on Svelte's behaviour where no contract covers it, so it can't be more stable than either.

A Svelte view for [Wordgard](https://www.wordgard.net): any decoration that takes a shape, a wrapper
or a widget can be a Svelte 5 component, mounted with your app's contexts. Wordgard keeps doing the
rest (input, selection, composition), and the API stays Wordgard's.

A Svelte decoration marks its content element with an attachment, reads your app's contexts and
stores, and can re-render on its own without breaking the editor.

It is [react-wordgard](https://github.com/stesura/react-wordgard/tree/master/packages/react) for
Svelte, over the same core. Its README goes deeper into Wordgard's side (shapes or wrappers, sharing
the model with a server, changing a node without remounting it); all of that holds here.

## Contents

- [Install](#install)
- [Usage](#usage)
  - [Reading and changing the editor](#reading-and-changing-the-editor)
  - [Svelte decorations](#svelte-decorations)
  - [The component's contract](#the-components-contract)
  - [Timing](#timing)
  - [Server rendering](#server-rendering)
  - [Limits](#limits)
- [API](#api)
- [Coming from react-wordgard](#coming-from-react-wordgard)
- [AI coding agents](#ai-coding-agents)
- [Licence](#licence)

## Install

```sh
npm install @stesura/svelte-wordgard wordgard svelte
```

- `wordgard` 0.7.0 exactly: svelte-wordgard uses Wordgard's internals, which any release can change.
- `svelte` 5.57, from 5.57.3: svelte-wordgard relies on how Svelte places its anchors, flushes and
  mounts, which no contract covers and even a patch release can change.
- Only one copy of `wordgard` in your app: `npm ls wordgard` should list one version. With two, the
  editor won't work.
- svelte-wordgard brings its core, `@stesura/wordgard-view`, at the same version: don't install or
  import it yourself.
- It ships `.svelte` files, compiled by your app's Svelte: a SvelteKit or Vite app with
  `@sveltejs/vite-plugin-svelte` takes them as they are.
- With TypeScript, `"skipLibCheck": true` in your `tsconfig.json`: Wordgard's own typings don't
  type-check ([#120](https://code.haverbeke.berlin/wordgard/wordgard/issues/120)).

## Usage

```svelte
<!-- Editor.svelte -->
<script lang="ts">
  import { Decoration, Wordgard } from "wordgard/editor";
  import { basicSchema, image } from "wordgard/schema";
  import { Image } from "wordgard/types";
  import { WordgardDoc, WordgardEditor, createShape } from "@stesura/svelte-wordgard";

  import ImageView from "./ImageView.svelte";
  import WordCount from "./WordCount.svelte";

  const config = [
    basicSchema(),
    image(),
    Decoration.Tag.shape(Image, createShape(ImageView)),
    Wordgard.label("Document"),
  ];
</script>

<WordgardEditor
  doc={'<p>Hello <strong>world</strong> <img src="/cat.png" alt="A cat"></p>'}
  {config}
>
  <WordCount />
  <WordgardDoc class="editor" />
</WordgardEditor>
```

```svelte
<!-- ImageView.svelte: the node type's element, an <img>. Wordgard's attributes (`src`, `alt`, the
     selected node's class) come as props, spread on the root. -->
<script lang="ts">
  import type { ShapeComponentProps } from "@stesura/svelte-wordgard";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
  let hover = $state(false);
</script>

<img
  {...rest}
  style:outline={hover ? "2px solid" : undefined}
  onmouseenter={() => (hover = true)}
  onmouseleave={() => (hover = false)}
/>
```

```svelte
<!-- WordCount.svelte -->
<script lang="ts">
  import { useEditorState } from "@stesura/svelte-wordgard";

  const editorState = useEditorState();
  const words = $derived(editorState.current.doc.textContent().split(/\s+/).filter(Boolean).length);
</script>

<output>{words} words</output>
```

`<WordgardEditor>` creates the editor from its props (`doc`, `config`, `selection`, `state`), **read
once**: the editor owns its state, and you change it with `wg.dispatch(…)`, its configuration with
Wordgard's compartments. `<WordgardDoc>` puts it in the page, in a `div` taking its attributes; one
per editor. `WordgardEditor` draws no element: wrap as much of the page in it as needs the editor.

Svelte refuses a variable named `state` beside the `$state` rune: name the editor's state otherwise
(`editorState`).

### Reading and changing the editor

Under `WordgardEditor`, inside the document or beside it:

- `useWordgard()`: the editor. Commands run through `Command.dispatch(wg, command)`, changes
  through `wg.dispatch({ changes, selection })`; `wg.state` is the latest state, dispatches not yet
  drawn included.
- `useEditorState()`: the state as of the editor's last update (the one the DOM shows), in
  `current`. Derive from it with `$derived`.
- `useEditorField(field, select?, isEqual?)`: a state field's value, or a part of it, in `current`;
  nothing runs on an update that leaves the field unchanged. `useEditorFieldEntry(field, key)`: one
  entry of a field holding a `Map`.
- `useEditorEffect((wg) => cleanup?, source?)`: runs once the editor's DOM is up to date, after it
  mounts and again when what `source` (a function) reads changes. What the effect itself reads isn't
  tracked. It may read layout and dispatch: for focus, menus, follow-up dispatches.
- `useEditorLayoutEffect({ read, write })`: inside every update, `read` in Wordgard's read phase and
  `write` in its write phase, on the same paint, without rendering; it can't dispatch. For what
  moves with the text (margin markers, pagination).
- `useEditorEventListener(type, (wg, event) => handled)`: the editor's DOM events, before
  Wordgard's handlers and keymaps; returning `true` handles the event. Keyboard, input, mouse
  (not `mousemove`), focus, clipboard and drag-and-drop events.

```svelte
<!-- BoldButton.svelte -->
<script lang="ts">
  import { Command, toggleStrong } from "wordgard/command";
  import { useEditorState, useWordgard } from "@stesura/svelte-wordgard";

  const wg = useWordgard();
  const editorState = useEditorState();
  const empty = $derived(editorState.current.selection.empty);
</script>

<button
  disabled={empty}
  onmousedown={(event) => {
    event.preventDefault();
    Command.dispatch(wg, toggleStrong);
  }}
>
  Bold
</button>
```

Menus and popovers: position them with your library (Floating UI) from `wg.coordsAtPos(pos)` in
`useEditorEffect`, shown or hidden from a `$derived` over the state. To react to changes without
rendering (autosave), add a `Wordgard.updateListener.of((update) => …)` to `config`. Components
outside `WordgardEditor` can't use the hooks: lift `WordgardEditor`, or share the editor through a
store from `useEditorEffect` and use it directly.

### Svelte decorations

Each factory takes a component, is **called at module level**, and returns a Wordgard value for
`config`:

| Need                                                      | Factory                                   | Passed to                                                                             |
| --------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------- |
| A node, with content or an atom (callout, image, mention) | `createShape(component)`                  | `Decoration.Tag.shape(Type, shape)`; `shape.of(element, { atom? })` for `Point.shape` |
| An element around a node or part of its shape             | `createWrapper(component, { element })`   | `Decoration.Tag.wrapper(Type, wrapper, { target? })`, `Decoration.Point.wrapper`      |
| A mark's element (link, comment highlight)                | `createMarkShape(component, { element })` | `Decoration.Mark.shape(MarkType, shape)`                                              |
| A widget at a position or beside a node (badge, mention)  | `createWidgetType({ component, … })`      | `Decoration.Point.widget(Type.of(value))`, `Decoration.Tag.widget`, `Tag.shape`       |
| Data for a node's shape, with no element                  | `nodeWrapper(Type, component)`            | `config` directly: it is an extension                                                 |

```svelte
<!-- Callout.svelte: a shape holding blocks, chrome before its content. DecorationRoot draws the
     node type's element. -->
<script lang="ts">
  import { DecorationRoot, type ShapeComponentProps } from "@stesura/svelte-wordgard";

  let { nodeProps, contentDOMRef, ...rest }: ShapeComponentProps = $props();
</script>

<DecorationRoot {...rest}>
  <span aria-hidden="true">!</span>
  <div {@attach contentDOMRef}></div>
</DecorationRoot>
```

```svelte
<!-- LinkMark.svelte: a mark, its root the content element. -->
<script lang="ts">
  import { DecorationRoot, type MarkComponentProps } from "@stesura/svelte-wordgard";

  let { markProps, contentDOMRef, ...rest }: MarkComponentProps = $props();
</script>

<DecorationRoot {...rest} content={contentDOMRef} href={String(markProps.mark.value)} />
```

```svelte
<!-- Resizer.svelte: a wrapper, with a handle beside what it wraps. What it wraps goes first in
     the element wrappedDOMRef marks. -->
<script lang="ts">
  import { type WrapperComponentProps, useStopEvent } from "@stesura/svelte-wordgard";

  let { nodeProps, wrappedDOMRef, class: className, ...rest }: WrapperComponentProps = $props();
  useStopEvent(() => true);
</script>

<span
  {...rest}
  class={[typeof className == "string" && className, "resizer"]}
  {@attach wrappedDOMRef}
>
  <span class="resize-handle" aria-hidden="true"></span>
</span>
```

```svelte
<!-- Badge.svelte: a widget. -->
<script lang="ts">
  import type { WidgetComponentProps } from "@stesura/svelte-wordgard";

  let { value, ...rest }: WidgetComponentProps<string> = $props();
</script>

<span {...rest} class="badge" aria-hidden="true">{value}</span>
```

```ts
// view.ts
import { Decoration } from "wordgard/editor";
import { Blockquote, Image, Link, Paragraph } from "wordgard/types";
import {
  createMarkShape,
  createShape,
  createWidgetType,
  createWrapper,
} from "@stesura/svelte-wordgard";

import Badge from "./Badge.svelte";
import Callout from "./Callout.svelte";
import LinkMark from "./LinkMark.svelte";
import Resizer from "./Resizer.svelte";

const BadgeWidget = createWidgetType<string>({ component: Badge });

export const view = [
  Decoration.Tag.shape(Blockquote, createShape(Callout)),
  Decoration.Mark.shape(Link, createMarkShape(LinkMark, { element: "a" })),
  // An image is inline: a span around it.
  Decoration.Tag.wrapper(Image, createWrapper(Resizer, { element: "span" })),
  Decoration.Tag.widget(Paragraph, "start", BadgeWidget.of("¶")),
];
```

Keep the model (node and mark types, schema elements, fields, commands) in a module without Svelte,
which a server can import, and the Svelte decorations in a client module adding decorations only.

`nodeWrapper(Type, component)` puts a component around every node of a type, drawing no element:
its root is `<WrappedNode />`, standing for the node's drawing, and the attributes you give it go
on the node's root element (`class` joined, Svelte's class arrays and objects read, handlers
dropped). It hands the node's Svelte shape data through `setContext`, and re-renders from its own
state without drawing the node again. Changing the wrappers in the configuration draws the whole
document again.

Inside a decoration's component: `useNodePos()` (a function giving its position, for handlers and
effects), `useIsNodeSelected()` (in `current`), `useSelectNode(select, deselect?)`,
`useStopEvent((wg, event) => stop)` for events in its chrome (its controls), and
`useIgnoreMutation((wg, record) => ignore)`.

### The component's contract

Each Svelte decoration is a root of its own (`mount`), placed in the document by svelte-wordgard,
which draws everything else itself: nothing Svelte puts beside a root (its anchors, a block's
comment) may land among the document's nodes.

- **One root, the element the decoration says, and its props spread on it.** For a shape, the node
  type's own outer element, per node (`h1` to `h6` for a heading); for `createWrapper`,
  `createMarkShape` and `.of(element)`, their `element` (`div` for wrappers, `span` for marks); for
  a widget, any element. Wordgard applies decorations to that element before Svelte draws, so the
  component can't choose it. Spread the props it doesn't use on the root (`{...rest}`): they are
  Wordgard's attributes (the node type's, the selection's `wg-selected-node`, tag and mark
  attributes). Nothing falls through by itself: a `class` of your own joins theirs
  (`class={[typeof className == "string" && className, "mine"]}`), or replaces it.
- **`<DecorationRoot {...rest}>`** draws that root, its tag the decoration's (a heading's level,
  per node), and follows when it changes.
- **At the top, one element, or one block (`{#if}`, `{#key}`) around one
  element, with nothing beside it in that block.** A root sharing a block with a sibling
  (`<p></p>{#if open}…{/if}`, or inside one `{#key}`) breaks the editor when the block draws it
  again: Svelte then removes the document's nodes after the root. A component may replace its root
  from its own state (an `{#if}` switching between two elements).
- **The content goes in an empty element marked `{@attach contentDOMRef}`**, which holds only the
  content; without one, the root holds it, and what's drawn there gets the decoration's contexts,
  not the component's. `<DecorationRoot content={contentDOMRef}>` makes the
  root the content element. Never `{@render children()}` or text there: Svelte's anchors would
  land among the content's nodes.
- **What a wrapper wraps goes first in the element marked `{@attach wrappedDOMRef}`.**
- Everything else the component draws is **chrome**: made uneditable, never read as content, free
  to change. In a textblock or a mark, the content element holds only the content; chrome beside a
  paragraph's text is a widget at its `"start"` or `"end"`. In a node holding blocks, chrome sits
  around the content element, in elements of its own.
- A component may move its content element (`contentDOMRef` on another element, from its own
  state): the content's DOM moves into it.
- Node parameters: `nodeProps.node.tag.param` for a node with content, `node.param` for a leaf;
  data an action changes in place is a mark on the tag (`node.tag.mark(Type)`), changed with
  `wg.dispatch({ changes: { from: pos, add: Type.of(value) } })`, which keeps the component mounted.

### Timing

Wordgard updates the DOM in its flush, on the next frame, and svelte-wordgard draws the document
inside it, committing Svelte's pending work there (`flushSync`).

- **Don't read the editor's layout (`coordsAtPos`) or force its update from a component's script,
  template, `$derived`, `$effect` or attachment**: the update is refused there and drawn on the
  next frame. Use `useEditorEffect`, `useEditorLayoutEffect` or an event handler.
- `useNodePos()`'s function throws before the decoration's tiles exist: call it from handlers and
  `useEditorEffect`.
- Components outside the document get a new state once the editor's update is done, their effects
  outside Wordgard's flush, where they may dispatch.
- An error a component in the document throws, in its setup or in a later update of its own, is
  logged; the next update draws the document again.
- Svelte's async mode (`experimental.async`) is supported (tested in Svelte's development build).
  A component suspending (`await`) in the document isn't.

### Server rendering

For a SvelteKit page that is only the editor, turn server rendering off for its route
(`export const ssr = false` in `+page.ts`): nothing then runs on the server.

A page that keeps server rendering (an editor under an article, a comment box) needs nothing either:
on the server, `WordgardEditor` creates no editor and draws nothing, since Wordgard needs the DOM,
to read its document's HTML too. Its children are drawn in the browser, as the page hydrates. Its
props are still built on the server: give the document as `doc` (HTML), or load it with
`schema.docFromJSON`; a `GardState.create({ doc: html })` in the page's script throws there. To keep
the editor's place meanwhile, draw a placeholder beside it with `{#if !browser}` (from
`$app/environment`).

### Limits

- A Svelte wrapper can't wrap text, or a node a native widget draws (draw it with a Svelte widget).
- A root leaving with an outro transition is still in the document when its replacement comes:
  the editor reports the component as drawing two roots.
- Each Svelte decoration is a root of its own: mounting thousands at once (bolding a long document
  with a Svelte mark shape) costs about 30 µs each.

## API

Everything is exported from `@stesura/svelte-wordgard`.

- Components: `WordgardEditor`, `WordgardDoc`, `DecorationRoot`, `WrappedNode`.
- Factories: `createShape`, `createWrapper`, `createMarkShape`, `createWidgetType`, `nodeWrapper`.
- Editor hooks, under `WordgardEditor`: `useWordgard`, `useEditorState`, `useEditorField`,
  `useEditorFieldEntry`, `useEditorEffect`, `useEditorLayoutEffect`, `useEditorEventListener`.
- Decoration hooks, in a decoration's component: `useNodePos`, `useIsNodeSelected`,
  `useSelectNode`, `useStopEvent`, `useIgnoreMutation`.
- Props types: `ShapeComponentProps`, `WrapperComponentProps`, `MarkComponentProps`,
  `WidgetComponentProps`, `NodeWrapperComponentProps`.
- `SvelteWordgard.create(spec)`: an editor drawn by svelte-wordgard outside a component tree
  (tests, benchmarks). In a Svelte app, use `WordgardEditor`.

The hooks' and components' signatures and details are in their typings (`dist/index.d.ts`).

## Coming from react-wordgard

| react-wordgard                                                       | svelte-wordgard                                                       |
| -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `{children}` in `contentDOMRef`'s element                            | an empty element with `{@attach contentDOMRef}`                       |
| A wrapper's `{children}`                                             | an element with `{@attach wrappedDOMRef}`, what's wrapped first in it |
| `{...props}` and `ref` on a root drawn by hand                       | `{...rest}` on the root: no ref, the root is found                    |
| `useEditorStateSelector(selector)`                                   | `$derived(selector(useEditorState().current))`                        |
| `useEditorEventCallback(callback)`                                   | a plain function using `useWordgard()`                                |
| `useEditorEffect(effect, deps)`                                      | `useEditorEffect(effect, source)`, `source` a function                |
| `NodeRootProps` in a node wrapper                                    | attributes on its `<WrappedNode />`                                   |
| `useIsNodeSelected()` returning a boolean                            | `useIsNodeSelected()` returning an object with `current`              |
| `WordgardScope`, `useMergedDOMRefs`, `staticCopy`, `isTrailingBreak` | none                                                                  |

## AI coding agents

The package ships a skill for building editors with svelte-wordgard: `skills/svelte-wordgard/` (in
`node_modules/@stesura/svelte-wordgard/`). Copy that folder into your project's `.claude/skills/`,
or point your agent to its `SKILL.md`.

## Licence

MIT, © 2026 Edoardo Caratti, see [LICENSE.txt](LICENSE.txt).

Includes code from react-prosemirror (© Handle with Care Collective and The New York Times
Company), through react-wordgard; its notices are in
[THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt). Its core, `@stesura/wordgard-view`, also
includes code from Wordgard (© Marijn Haverbeke).
