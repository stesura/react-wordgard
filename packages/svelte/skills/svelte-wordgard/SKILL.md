---
name: svelte-wordgard
description: Build rich text editors with Wordgard and svelte-wordgard in a Svelte 5 app (SvelteKit included). Use whenever the work involves Wordgard or svelte-wordgard - writing, reviewing, debugging or discussing code that uses them. Covers hosting the editor, drawing nodes, marks, wrappers or widgets as Svelte components, reading the editor's state in components, positioning menus and popovers, and handling the editor's events.
---

# Building editors with Wordgard and svelte-wordgard

svelte-wordgard is a Svelte view for [Wordgard](https://wordgard.net/docs/), a rich text editor.
Wordgard runs the editor (document, state, input, selection, IME composition, decorations,
commands); svelte-wordgard draws its document inside Wordgard's own update, and mounts Svelte
components where decorations say, with the app's contexts. **The API is Wordgard's**: a
customisation is a Wordgard extension or decoration, and svelte-wordgard adds functions that let a
Svelte component be the decoration.

Wordgard's own API: its docs (https://wordgard.net/docs/) and its typings in
`node_modules/wordgard/dist/*.d.ts` (`wordgard/editor`, `wordgard/state`, `wordgard/doc`,
`wordgard/schema`, `wordgard/types`, `wordgard/command`). svelte-wordgard's: its README and
`node_modules/@stesura/svelte-wordgard/dist/index.d.ts`. Read them rather than guessing a signature.

**New to Wordgard, or porting ProseMirror code?** Read `references/wordgard.md`, next to this file:
Wordgard's model (plots, leaves, tags, marks on tags), changes, configuration, commands and the
editor, each against its ProseMirror counterpart, with the traps.

## Setup

```sh
npm install @stesura/svelte-wordgard wordgard svelte
```

- Peers: `wordgard` `0.7.0` exactly (svelte-wordgard uses its internals), `svelte` `~5.57.3` (it
  relies on Svelte's behaviour where no contract covers it). The app must have **one copy** of
  `wordgard`, or Wordgard's `instanceof` checks fail.
- The package ships `.svelte` files: the app compiles them (SvelteKit, or Vite with
  `@sveltejs/vite-plugin-svelte`).
- TypeScript: Wordgard's typings need `skipLibCheck: true`.
- Name the editor for screen readers with `Wordgard.label("…")` in the config.
- **Never name a variable `state`** in a component: Svelte refuses it beside the `$state` rune. Use
  `editorState`.

## Hosting the editor

```svelte
<!-- Editor.svelte -->
<script lang="ts">
  import { basicSchema } from "wordgard/schema";
  import { WordgardDoc, WordgardEditor } from "@stesura/svelte-wordgard";

  const config = [basicSchema()];
</script>

<WordgardEditor doc="<p>Hello</p>" {config}>
  <WordgardDoc class="editor" />
</WordgardEditor>
```

- `WordgardEditor` takes a `Wordgard.Spec` (`doc` as HTML, `config` as extensions, or a `state`),
  **read once**: the editor owns its state. Change the document through `wg.dispatch(…)`, the
  configuration through Wordgard's compartments or `GardState.appendConfig`, never with new props.
- `WordgardDoc` puts the editor in the page, in a `div` taking its attributes; one per editor (a
  second throws). Components inside `WordgardEditor` (toolbars, menus, next to `WordgardDoc`) can
  use the hooks. `WordgardEditor` draws no element.
- **SvelteKit:** a page that is only the editor turns server rendering off for its route
  (`export const ssr = false` in `+page.ts`). A page that keeps it needs nothing either: on the
  server, `WordgardEditor` creates no editor and draws nothing (Wordgard needs the DOM), and its
  children are drawn in the browser as the page hydrates; no `{#if browser}` around it. The props
  are built on the server there too: give the document as `doc`, or load it with
  `schema.docFromJSON`. A `GardState.create({ doc: html })` in the page's script throws there
  (Wordgard parses HTML with the DOM). A placeholder for the server's HTML goes beside it, in
  `{#if !browser}` (`$app/environment`).
- Don't create editors with `Wordgard.create` in a Svelte app. `SvelteWordgard.create(spec)` is for
  tests and benchmarks outside a component tree.

## Reading and changing the editor from components

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

- `useWordgard()`: the editor (`wg`). Use it in handlers: there is no `useEditorEventCallback`.
  `wg.state` is the latest state, dispatches not yet drawn included.
- `useEditorState()`: the state as of the editor's last update (the one the DOM shows), in
  `current`. Derive with `$derived`: there is no `useEditorStateSelector`.
- `useEditorField(field, select?, isEqual?)`: a state field's value or a part of it, in `current`;
  it compares the field once per update and runs nothing when the field didn't change. Prefer it to
  a `$derived` reading a field from the state. `useEditorFieldEntry(field, key)`: one entry of a
  field holding a `Map`, changing only when that entry does. The field must be in the configuration.
- `useEditorEventListener(type, (wg, event) => handled)`: the editor's DOM events of `type`, before
  Wordgard's handlers and keymaps; return `true` to handle the event. Keyboard, input, composition,
  mouse (not `mousemove`), `focus`, `blur`, clipboard and drag-and-drop events; touch, wheel and
  pointer events aren't offered (add a `Wordgard.domEventHandler` to `config`). Leave typing
  (`input`, `beforeinput`, composition) to Wordgard.
- Outside `WordgardEditor` the hooks throw: lift `WordgardEditor` (it draws no element), or put the
  editor in a store from `useEditorEffect` and use it directly there. There is no `WordgardScope`.
- To react to changes without rendering (autosave), add a
  `Wordgard.updateListener.of((update) => …)` to `config`.
- Save with `wg.state.doc.toJSON()`, load with `state.schema.docFromJSON(json)` as `doc`.

### Effects and layout

| Hook                                         | Runs                                                              | May dispatch | What it sets shows | For                                      |
| -------------------------------------------- | ----------------------------------------------------------------- | ------------ | ------------------ | ---------------------------------------- |
| `useEditorEffect((wg) => cleanup?, source?)` | after the editor's update; again when what `source` reads changes | yes          | a frame later      | focus, follow-up dispatches, menus       |
| `useEditorLayoutEffect({ read, write })`     | inside every update: `read`, then `write`                         | **no**       | on the same paint  | what moves with the text: margin markers |

- `source` is a function; what it reads is tracked, what the effect reads isn't. Without it the
  effect runs once mounted; its cleanup runs before the next run and on unmount.
- **Never read the editor's layout (`coordsAtPos`, `posAtCoords`) or force its update from a
  component's script, template, `$derived`, `$effect`, `$effect.pre` or attachment**: the update is
  refused and drawn on the next frame. Use one of the two hooks, or an event handler.
- `read` returning `undefined` skips the write and Wordgard's second measure.
- Components outside the document get a new state once the editor's update is done; in tests,
  `flushSync()` (or `await tick()`) before reading them.
- Menus and popovers: position them with your library (Floating UI) from a virtual anchor built
  from `wg.coordsAtPos(pos)` in `useEditorEffect`; show or hide them from a `$derived`.

## Drawing parts of the document with Svelte

**Keep the model apart from Svelte.** A server loads documents with the client's schema and fields.
Define node and mark types, schema elements, fields, commands and keys in a module without Svelte
that both sides import, and Svelte decorations in a client module that only adds decorations.

Prefer Wordgard's declarative shapes (`Elt` shapes, `Decoration.Tag.attribute`, mark shapes) for
what needs no code. Use a Svelte component where a part needs state, interaction or the app's
contexts. Each factory is **called at module level** and returns a Wordgard value for `config`:

| Need                                                      | Factory                                   | Passed to                                                                             |
| --------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------- |
| A node, with content or an atom (callout, image, mention) | `createShape(component)`                  | `Decoration.Tag.shape(Type, shape)`; `shape.of(element, { atom? })` for `Point.shape` |
| An element around a node or part of its shape             | `createWrapper(component, { element })`   | `Decoration.Tag.wrapper(Type, wrapper, { target? })`, `Decoration.Point.wrapper`      |
| A mark's element (link, comment highlight)                | `createMarkShape(component, { element })` | `Decoration.Mark.shape(MarkType, shape)`                                              |
| A widget at a position or beside a node (badge, mention)  | `createWidgetType({ component, … })`      | `Decoration.Point.widget(Type.of(value))`, `Decoration.Tag.widget`, `Tag.shape`       |
| Data for a node's shape, with no element                  | `nodeWrapper(Type, component)`            | `config` directly: it is an extension                                                 |

```svelte
<!-- Callout.svelte -->
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
<!-- LinkMark.svelte -->
<script lang="ts">
  import { DecorationRoot, type MarkComponentProps } from "@stesura/svelte-wordgard";

  let { markProps, contentDOMRef, ...rest }: MarkComponentProps = $props();
</script>

<DecorationRoot {...rest} content={contentDOMRef} href={String(markProps.mark.value)} />
```

```ts
// view.ts: client only.
import { Decoration } from "wordgard/editor";
import { Blockquote, Link } from "wordgard/types";
import { createMarkShape, createShape } from "@stesura/svelte-wordgard";

import Callout from "./Callout.svelte";
import LinkMark from "./LinkMark.svelte";

export const view = [
  Decoration.Tag.shape(Blockquote, createShape(Callout)),
  Decoration.Mark.shape(Link, createMarkShape(LinkMark, { element: "a" })),
];
```

The component's props: `nodeProps` (`node`, `getPos`) and `contentDOMRef` for shapes, `nodeProps`
and `wrappedDOMRef` for wrappers, `nodeProps` for node wrappers, `markProps` (`mark`, `getPos`) and
`contentDOMRef` for marks, `value` for widgets; the rest are Wordgard's attributes, for the root.
Node parameters: `nodeProps.node.tag.param` for a node with content, `node.param` for a leaf;
`markProps.mark.value` is the mark's.

### The component's contract

Each Svelte decoration is mounted as a root of its own and placed in the document by
svelte-wordgard, which draws everything else itself. What Svelte puts beside a root (its anchors, a
block's comment) must stay out of the document's content.

- **One root, the element the decoration says, and it stays that element.** For a shape, the node
  type's own outer element, per node (`h1` to `h6` for a heading); for `.of`, `createWrapper` and
  `createMarkShape`, their `element` (`div` for wrappers, `span` for marks, by default); for a
  widget, the type's `element` (`span`) or any one element. Wordgard applies decorations to the
  shape before Svelte draws (`target` selectors match its tag), so the tag can't come from the
  component.
- **Spread the rest of the props on the root (`{...rest}`)**: Wordgard's attributes (the node
  type's, `wg-selected-node`, tag, point and mark attributes, `contenteditable` on an atom). Nothing
  falls through by itself. A `class` of your own after the spread replaces Wordgard's: join them,
  `class={[typeof className == "string" && className, "mine"]}` with `class: className` taken out
  of the props.
- **`<DecorationRoot {...rest}>`** draws that root, of the decoration's tag (a heading's level), and
  follows when it changes. Or draw the element by hand. No ref to forward: the root is found.
- **At the top: one element, or one `{#if}` or `{#key}` around one element, with nothing beside it
  in that block.** `<figure></figure>{#if x}…{/if}` at the top, or both inside one `{#key}`, breaks
  the editor when the block draws again (Svelte removes the document's nodes after the root). Put
  the `{#if}` inside the root. Switching the root between elements from the component's own state
  is fine.
- **The content goes in an empty element marked `{@attach contentDOMRef}`**, holding only the
  content. Without it, the root holds the content (and what's drawn there doesn't get the
  component's contexts); `<DecorationRoot content={contentDOMRef}>` makes
  the root the content element, which a mark drawn by `DecorationRoot` needs (its children would
  put Svelte's anchors among the mark's elements). **Never `{@render children()}` or text in a
  content element.**
- **What a wrapper wraps goes first in the element marked `{@attach wrappedDOMRef}`**; the wrapper's
  own children come after it.
- **An atom** (a leaf, or a plot whose shape has no hole) has no content: no `contentDOMRef`.
  `.of(element, { atom: true })` has no hole.
- Everything else the component draws is **chrome**: uneditable, never read as content, free to
  change from the component's state, a context or a store.
  - In a textblock or a mark, the content element holds only the content. Chrome beside a
    textblock's text is a Svelte widget at its `"start"` or `"end"`:
    `Decoration.Tag.widget(Paragraph, "start", LineNumber.of(null))`.
  - In a node holding blocks, chrome sits around the content element, in elements of its own;
    `{#if}` and `{#each}` there are fine.
  - Chrome inherits the editor's `white-space: pre-wrap`, which draws the space Svelte keeps
    between elements on separate lines (a blank line between a title bar and the content element):
    give the root `white-space: normal` and the content element `white-space: pre-wrap`.
  - A component may move its content element (an `{#if}` putting `contentDOMRef` on another
    element): the content's DOM moves with it.
- No outro transitions on a root: the leaving root is still there when its replacement comes.
- **Don't write attributes on document elements by hand** (`classList.add`): Svelte or Wordgard
  undoes them. Put the state in the component (`data-resizing={resizing}`), or in a decoration from
  a state field.

### Widgets

```svelte
<!-- Badge.svelte -->
<script lang="ts">
  import type { WidgetComponentProps } from "@stesura/svelte-wordgard";

  let { value, ...rest }: WidgetComponentProps<string> = $props();
</script>

<span {...rest} class="badge" aria-hidden="true">{value}</span>
```

```ts
// badges.ts
import { Decoration } from "wordgard/editor";
import { Paragraph } from "wordgard/types";
import { createWidgetType } from "@stesura/svelte-wordgard";

import Badge from "./Badge.svelte";

const BadgeType = createWidgetType<string>({ component: Badge });

export const badges = Decoration.Tag.widget(Paragraph, "start", BadgeType.of("¶"));
```

- `createWidgetType({ component, element?, eq?, editable?, inFlow?, propagateEvent?, connect?,
disconnect? })` returns a real `Widget.Type`: its widgets are `Type.of(value)`.
- Widgets can't be edited unless their spec sets `editable`. Wordgard 0.7.0 makes a widget's root
  `contenteditable="false"` only when it's a void element (`img`, `br`, `hr`, `input`, `wbr`): set
  it yourself where a style or a script reads it.
- A widget drawing a node (`Decoration.Tag.shape(Type, (tag) => W.of(tag.param))`) gets the node's
  attributes as props, to spread on its root. A Svelte shape is the usual way to draw a node.
- A widget's component reads the contexts of the Svelte shape it's drawn in (line numbers from a
  paragraph's shape), when the shape marks its content element with `contentDOMRef`: content in a
  root that holds it gets the decoration's contexts, not the component's.

### Should I use a shape, a wrapper or both?

A shape draws the node; a wrapper adds Svelte around it. A node's outer element comes from its
type's shape in the schema, and Wordgard applies marks and decorations to it before Svelte draws.
So the shape's root matches the node type's element, and chrome around it is a wrapper:

```svelte
<!-- Resizer.svelte -->
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

```ts
// image.ts
import { Decoration } from "wordgard/editor";
import { Image } from "wordgard/types";
import { createWrapper } from "@stesura/svelte-wordgard";

import Resizer from "./Resizer.svelte";

// An image is inline: a span around it.
export const imageConfig = Decoration.Tag.wrapper(
  Image,
  createWrapper(Resizer, { element: "span" })
);
```

- A wrapper can aim at an element inside the type's shape: `{ target: "img" }`.
- **One `Decoration.Tag.shape` per node type**: fold several features' components into one, or
  give each a wrapper or a tag widget.
- `createWrapper` can't wrap text, nor a node a native widget draws (draw it with a Svelte widget).

### Handing a node data without drawing it

`nodeWrapper(Type, component)` is a component around every node of a type that draws **no
element**: its root is `<WrappedNode />`, standing for the node's drawing, and the attributes it
gives `WrappedNode` go on the node's root element (a class, a style, a data attribute, even for a
node Wordgard draws; handlers are dropped). It hands a Svelte shape data through `setContext` and
re-renders from its own state without drawing the node again. Several on one type nest, the highest
precedence outermost. `nodeWrapper((type) => boolean, component)` wraps every type the function
picks, defined at module level. Put the wrappers in the configuration once: changing them draws the
whole document again.

```svelte
<!-- Lead.svelte -->
<script lang="ts">
  import { setContext } from "svelte";
  import { WrappedNode } from "@stesura/svelte-wordgard";

  let lead = $state("Note");
  setContext("lead", {
    get current() {
      return lead;
    },
  });
</script>

<WrappedNode class="led" />
```

### Changing a node without remounting it

A component keeps its state while its node changes in place or moves within its parent; it
remounts when the node is replaced whole, changes type or moves to another parent.

- **Data an action changes in place** (size, a callout's kind): a mark on the tag,
  `Mark.Type.define(name, { target: NodeType, … })`, read with `node.tag.mark(Type)`, changed with
  `wg.dispatch({ changes: { from: pos, add: Type.of(v) } })` or `{ from: pos, remove: Type.of(v) }`.
- **What identifies the node** (an image's `src`, a heading's level): its parameter, changed by
  retagging the opening token, `{ from: pos, to: pos + 1, insert: [Heading.of(2)] }`.
- **Never** replace the whole node to change its data: that remounts the component.

### Hooks inside Svelte decorations

- `useNodePos()`: a function returning the position of what the decoration draws. Call it in
  handlers and `useEditorEffect`, not during setup (the tiles don't exist yet).
- `useIsNodeSelected()` (an object with `current`), `useSelectNode(select, deselect?)`: the node
  selection.
- `useStopEvent((wg, event) => stop)`: asked for events in the decoration's chrome (its root and
  the elements around its content element) and in Svelte widgets, never for those in its content.
  For an event it stops, Wordgard's handlers and keymaps are skipped and the browser's default goes
  ahead. Controls in chrome need it.
- `useIgnoreMutation((wg, record) => ignore)`: Wordgard doesn't read the DOM mutations it claims.

## Accessibility

- The editable element has `role="textbox"` and `aria-multiline`; give it a name (Setup).
- Chrome is read inline with the document's text: `aria-hidden` on decorative parts, a name on
  every control, controls wrapped in `useStopEvent` so Wordgard leaves their keys.

## Coming from react-wordgard

| react-wordgard                                                       | svelte-wordgard                                                       |
| -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `{children}` in `contentDOMRef`'s element                            | an empty element with `{@attach contentDOMRef}`                       |
| A wrapper's `{children}`                                             | an element with `{@attach wrappedDOMRef}`, what's wrapped first in it |
| `{...props}` and `ref` on a root drawn by hand                       | `{...rest}` on the root, no ref                                       |
| `useEditorStateSelector(selector)`                                   | `$derived` over `useEditorState().current`                            |
| `useEditorEventCallback(callback)`                                   | a plain function using `useWordgard()`                                |
| `useEditorEffect(effect, deps)`                                      | `useEditorEffect(effect, source)`                                     |
| `NodeRootProps` in a node wrapper                                    | attributes on its `<WrappedNode />`                                   |
| `WordgardScope`, `useMergedDOMRefs`, `staticCopy`, `isTrailingBreak` | none                                                                  |

## When something fails

- "A Svelte shape's component must draw one element at its root (DecorationRoot or an element)"
  (or wrapper, mark, widget): the root is a block drawing several elements, none, or a second
  element appeared beside it.
- "…drew <x> where its shape says <y>" (logged): draw the element the shape says (the node type's,
  or `element`), or pass the drawn one to the shape's `of`.
- "Svelte's DOM has extra nodes", "…chrome is between its content's nodes", "…holds an empty text
  node or a comment beside its content", "A Svelte content element is drawn empty": something
  besides the content sits in a content element or among a mark's elements (a `{@render}`, text,
  an `{#if}`); see the contract.
- "WrappedNode is what a Svelte node wrapper wraps: use it in its component": a `WrappedNode`
  outside a node wrapper's component.
- "A Svelte wrapper's component must draw an element with wrappedDOMRef": a wrapper marked no
  element. "A Svelte node wrapper draws no element: its root is a WrappedNode".
- "A Svelte shape can't wrap: use createWrapper", "A Svelte wrapper isn't a shape: use
  createShape": a factory's value went to the other decoration. "Not a Svelte shape" (widget, mark,
  wrapper): a React or Vue decoration in a Svelte editor.
- "…is called outside a Svelte shape, wrapper, mark or widget": a decoration hook, or
  `DecorationRoot`, used elsewhere.
  "…is used outside a Wordgard editor": an editor hook outside `WordgardEditor`.
- "This Svelte shape or wrapper isn't drawn" (or widget, mark): `useNodePos()`'s function called
  during setup or after unmount.
- "A Svelte wrapper can't wrap a native widget: draw … with a Svelte widget", "A Svelte wrapper
  can't wrap text".
- "This editor is already rendered by another WordgardDoc": one `WordgardDoc` per editor.
- "SvelteWordgard can't update from inside a Svelte effect, template, $derived or attachment":
  layout read, or the editor flushed, from there; use `useEditorEffect`, `useEditorLayoutEffect`
  or an event handler.
- "svelte-wordgard can't render part of …": a shape or decoration it doesn't draw yet; the message
  names the node type.
- "Cannot dispatch new updates during the editor flush phase": a dispatch from
  `useEditorLayoutEffect` or a component's script; dispatch from an event handler or
  `useEditorEffect`.
- Content of other nodes vanishing when a component re-renders: a root sharing a block with a
  sibling (see the contract).
- Two copies of `wordgard` (`npm ls wordgard`) break `instanceof` checks in odd places.
