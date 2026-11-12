---
name: vue-wordgard
description: Build rich text editors with Wordgard and vue-wordgard in a Vue 3 app. Use whenever the work involves Wordgard or vue-wordgard - writing, reviewing, debugging or discussing code that uses them. Covers hosting the editor, drawing nodes, marks, wrappers or widgets as Vue components, reading the editor's state in components, positioning menus and popovers, and handling the editor's events.
---

# Building editors with Wordgard and vue-wordgard

vue-wordgard is a Vue view for [Wordgard](https://wordgard.net/docs/), a rich text editor.
Wordgard runs the editor (document, state, input, selection, IME composition, decorations,
commands); vue-wordgard has Vue draw its document, inside Wordgard's own update, in the app's tree,
so what the app provides reaches what it draws. **The API is Wordgard's**: a customisation is a
Wordgard extension or decoration, and vue-wordgard adds functions that let a Vue component be the
decoration.

Wordgard's own API: its docs (https://wordgard.net/docs/) and its typings in
`node_modules/wordgard/dist/*.d.ts` (`wordgard/editor`, `wordgard/state`, `wordgard/doc`,
`wordgard/schema`, `wordgard/types`, `wordgard/command`). vue-wordgard's: its README and
`node_modules/@stesura/vue-wordgard/dist/index.d.ts`. Read them rather than guessing a signature.

**New to Wordgard, or porting ProseMirror code?** Read `references/wordgard.md`, next to this file:
Wordgard's model (plots, leaves, tags, marks on tags), changes, configuration, commands and the
editor, each against its ProseMirror counterpart, with the traps.

## Setup

```sh
npm install @stesura/vue-wordgard wordgard vue
```

- Peers: `wordgard` `0.7.0` exactly (vue-wordgard uses its internals), `vue` `~3.5.45` (and some of
  Vue's). The app must have **one copy** of `wordgard`, or Wordgard's `instanceof` checks fail.
- TypeScript: Wordgard's typings need `skipLibCheck: true`.
- Keep Vue's Options API on (the default): the document's components commit inside Wordgard's
  update through a mixin.
- Name the editor for screen readers with `Wordgard.label("…")` in the config.

## Hosting the editor

```vue
<!-- Editor.vue -->
<script setup lang="ts">
import { basicSchema } from "wordgard/schema";
import { WordgardDoc, WordgardEditor } from "@stesura/vue-wordgard";

const config = [basicSchema()];
</script>

<template>
  <WordgardEditor doc="<p>Hello</p>" :config="config">
    <WordgardDoc class="editor" />
  </WordgardEditor>
</template>
```

- `WordgardEditor` takes a `Wordgard.Spec` (`doc` as HTML, `config` as extensions, or a `state`),
  **read once**, in its setup: the editor owns its state. Change the document through
  `wg.dispatch(…)`, the configuration through Wordgard's compartments or `GardState.appendConfig`,
  never with new props.
- `WordgardDoc` puts the editor in the page, in a `div` taking its attributes; one per editor (a
  second throws). Components inside `WordgardEditor` (toolbars, menus, next to `WordgardDoc`) can
  use the composables. `WordgardEditor` draws no element.
- Don't create editors with `Wordgard.create` in a Vue app. `VueWordgard.create(spec)` is for
  tests and benchmarks outside a component tree.

## Reading and changing the editor from components

```vue
<!-- BoldButton.vue -->
<script setup lang="ts">
import { computed } from "vue";
import { Command, toggleStrong } from "wordgard/command";
import { useEditorState, useWordgard } from "@stesura/vue-wordgard";

const wg = useWordgard();
const state = useEditorState();
const empty = computed(() => state.value.selection.empty);
const bold = () => Command.dispatch(wg, toggleStrong);
</script>

<template>
  <button :disabled="empty" @mousedown.prevent="bold">Bold</button>
</template>
```

- `useWordgard()`: the editor (`wg`). Use it in handlers: there is no `useEditorEventCallback`.
  `wg.state` is the latest state, dispatches not yet drawn included.
- `useEditorState()`: a `shallowRef` of the state as of the editor's last update (the one the DOM
  shows). Derive with `computed`: there is no `useEditorStateSelector`.
- `useEditorField(field, select?, isEqual?)`: a `computed` of a state field's value or a part of
  it; it compares the field once per update and runs nothing when the field didn't change. Prefer
  it to a `computed` reading a field from the state. `useEditorFieldEntry(field, key)`: one entry of
  a field holding a `Map`, changing only when that entry does. The field must be in the
  configuration.
- `useEditorEventListener(type, (wg, event) => handled)`: the editor's DOM events of `type`, before
  Wordgard's handlers and keymaps; return `true` to handle the event. Keyboard, input, composition,
  mouse (not `mousemove`), `focus`, `blur`, clipboard and drag-and-drop events; touch, wheel and
  pointer events aren't offered (add a `Wordgard.domEventHandler` to `config`). Leave typing
  (`input`, `beforeinput`, composition) to Wordgard.
- Outside `WordgardEditor` the composables throw: lift `WordgardEditor` (it draws no element), or
  put the editor in a store from `useEditorEffect` and use it directly there. There is no
  `WordgardScope`.
- To react to changes without rendering (autosave), add a
  `Wordgard.updateListener.of((update) => …)` to `config`.
- Save with `wg.state.doc.toJSON()`, load with `state.schema.docFromJSON(json)` as `doc`.

### Effects and layout

| Composable                                   | Runs                                                   | May dispatch | What it sets shows | For                                      |
| -------------------------------------------- | ------------------------------------------------------ | ------------ | ------------------ | ---------------------------------------- |
| `useEditorEffect((wg) => cleanup?, source?)` | after the editor's update; again when `source` changes | yes          | a frame later      | focus, follow-up dispatches, menus       |
| `useEditorLayoutEffect({ read, write })`     | inside every update: `read`, then `write`              | **no**       | on the same paint  | what moves with the text: margin markers |

- `source` is what `watch` takes (a ref, a getter, an array). Without it the effect runs once
  mounted; its cleanup runs before the next run and on unmount.
- **Never read the editor's layout (`coordsAtPos`, `posAtCoords`) or force its update from a
  component's setup, render or hooks (`onMounted`, `watch` callbacks running there)**: the update is
  refused and drawn on the next frame. Use one of the two composables, or an event handler.
- `read` returning `undefined` skips the write and Wordgard's second measure.
- Components outside the document render a new state in Vue's next tick (same paint); in tests,
  `await nextTick()` before reading them.
- Menus and popovers: position them with your library (Floating UI) from a virtual anchor built
  from `wg.coordsAtPos(pos)` in `useEditorEffect`; show or hide them from a `computed`.

## Drawing parts of the document with Vue

**Keep the model apart from Vue.** A server loads documents with the client's schema and fields.
Define node and mark types, schema elements, fields, commands and keys in a module without Vue
that both sides import, and Vue decorations in a client module that only adds decorations.

Prefer Wordgard's declarative shapes (`Elt` shapes, `Decoration.Tag.attribute`, mark shapes) for
what needs no code. Use a Vue component where a part needs state, interaction or what the app
provides. Each factory is **called at module level** and returns a Wordgard value for `config`:

| Need                                                      | Factory                                   | Passed to                                                                             |
| --------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------- |
| A node, with content or an atom (callout, image, mention) | `createShape(component)`                  | `Decoration.Tag.shape(Type, shape)`; `shape.of(element, { atom? })` for `Point.shape` |
| An element around a node or part of its shape             | `createWrapper(component, { element })`   | `Decoration.Tag.wrapper(Type, wrapper, { target? })`, `Decoration.Point.wrapper`      |
| A mark's element (link, comment highlight)                | `createMarkShape(component, { element })` | `Decoration.Mark.shape(MarkType, shape)`                                              |
| A widget at a position or beside a node (badge, mention)  | `createWidgetType({ component, … })`      | `Decoration.Point.widget(Type.of(value))`, `Decoration.Tag.widget`, `Tag.shape`       |
| Data for a node's shape, with no element                  | `nodeWrapper(Type, component)`            | `config` directly: it is an extension                                                 |

```vue
<!-- Callout.vue -->
<script setup lang="ts">
import { DecorationRoot, NodeContent, type ShapeComponentProps } from "@stesura/vue-wordgard";

defineProps<ShapeComponentProps>();
</script>

<template>
  <DecorationRoot>
    <span aria-hidden="true">!</span>
    <NodeContent as="div" />
  </DecorationRoot>
</template>
```

```vue
<!-- LinkMark.vue -->
<script setup lang="ts">
import { DecorationRoot, type MarkComponentProps } from "@stesura/vue-wordgard";

defineProps<MarkComponentProps>();
</script>

<template>
  <DecorationRoot content :href="String(markProps.mark.value)" />
</template>
```

```ts
// view.ts: client only.
import { Decoration } from "wordgard/editor";
import { Blockquote, Link } from "wordgard/types";
import { createMarkShape, createShape } from "@stesura/vue-wordgard";

import Callout from "./Callout.vue";
import LinkMark from "./LinkMark.vue";

export const view = [
  Decoration.Tag.shape(Blockquote, createShape(Callout)),
  Decoration.Mark.shape(Link, createMarkShape(LinkMark, { element: "a" })),
];
```

The component declares its props: `nodeProps` (`node`, `getPos`) for shapes, wrappers and node
wrappers, `markProps` (`mark`, `getPos`) for marks, `value` for widgets. Node parameters:
`nodeProps.node.tag.param` for a node with content, `node.param` for a leaf; `markProps.mark.value`
is the mark's.

### The component's contract

- **One root, the element the decoration says, and it stays that element.** For a shape, the node
  type's own outer element, per node (`h1` to `h6` for a heading); for `.of`, `createWrapper` and
  `createMarkShape`, their `element` (`div` for wrappers, `span` for marks, by default); for a
  widget, the type's `element` (`span`) or any one element. Wordgard applies decorations to the
  shape before Vue draws (`target` selectors match its tag), so the tag can't come from the
  component. **No `v-if`, `v-for`, `:key` or several roots at the root**: the editor breaks.
- **`<DecorationRoot>`** draws that root. Or draw the element by hand: Wordgard's attributes (the
  node type's, `wg-selected-node`, tag, point and mark attributes, `contenteditable` on an atom)
  fall through to any single root, classes joined, styles merged, Wordgard's winning for the rest;
  `inheritAttrs: false` drops them. No ref to forward.
- **The content is `<NodeContent as="div" />`**, the content element, holding the node's content.
  **Never `<slot />`**, never `{{ }}` of the content: a slot puts empty text nodes beside the text.
  `<DecorationRoot content />` makes the root the content element; a component moving its content
  in and out of an inner element keeps `DecorationRoot content` rather than switching to
  `NodeContent` (another root, remounted).
- **What a wrapper wraps is `<WrappedNode />`**, drawn once.
- **An atom** (a leaf, or a plot whose shape has no hole) has no content: no `NodeContent`.
  `.of(element, { atom: true })` has no hole.
- Everything else the component draws is **chrome**: uneditable, never read as content, free to
  change from the component's state, an `inject` or a store.
  - In a textblock or a mark, the content element holds only the content. Chrome beside a
    textblock's text is a Vue widget at its `"start"` or `"end"`:
    `Decoration.Tag.widget(Paragraph, "start", LineNumber.of(null))`.
  - In a node holding blocks, chrome sits before or after the content, never between its nodes:
    in `NodeContent`'s `before` and `after` slots, or as siblings of `NodeContent` in the root.
  - Vue's anchors (a `v-if`'s comment, a fragment's empty text nodes) can't sit in a content
    element or among a mark's elements. `DecorationRoot`'s slot and `NodeContent`'s slots drop
    them; elsewhere, wrap a `v-if` in an element.
  - Moving `<NodeContent>` or `<WrappedNode>` under another element remounts the content (a
    selection or IME composition in it ends).
- **Don't write attributes on document elements by hand** (`classList.add`): Vue or Wordgard undoes
  them. Put the state in the component (`:data-resizing="resizing"`), or in a decoration from a
  state field.

### Widgets

```vue
<!-- Badge.vue -->
<script setup lang="ts">
import { DecorationRoot } from "@stesura/vue-wordgard";

defineProps<{ value: string }>();
</script>

<template>
  <DecorationRoot class="badge" aria-hidden="true">{{ value }}</DecorationRoot>
</template>
```

```ts
// badges.ts
import { Decoration } from "wordgard/editor";
import { Paragraph } from "wordgard/types";
import { createWidgetType } from "@stesura/vue-wordgard";

import Badge from "./Badge.vue";

const BadgeType = createWidgetType<string>({ component: Badge });

export const badges = Decoration.Tag.widget(Paragraph, "start", BadgeType.of("¶"));
```

- `createWidgetType({ component, element?, eq?, editable?, inFlow?, propagateEvent?, connect?,
disconnect? })` returns a real `Widget.Type`: its widgets are `Type.of(value)`.
- Widgets can't be edited unless their spec sets `editable`. Wordgard 0.7.0 makes a widget's root
  `contenteditable="false"` only when it's a void element (`img`, `br`, `hr`, `input`, `wbr`): set
  it yourself where a style or a script reads it.
- A widget drawing a node (`Decoration.Tag.shape(Type, (tag) => W.of(tag.param))`) gets the node's
  attributes, which fall through to its root. A Vue shape is the usual way to draw a node.

### Should I use a shape, a wrapper or both?

A shape draws the node; a wrapper adds Vue around it. A node's outer element comes from its type's
shape in the schema, and Wordgard applies marks and decorations to it before Vue draws. So the
shape's root matches the node type's element, and chrome around it is a wrapper:

```vue
<!-- Resizer.vue -->
<script setup lang="ts">
import {
  DecorationRoot,
  WrappedNode,
  type WrapperComponentProps,
  useStopEvent,
} from "@stesura/vue-wordgard";

defineProps<WrapperComponentProps>();
useStopEvent(() => true);
</script>

<template>
  <DecorationRoot class="resizer">
    <WrappedNode />
    <span class="resize-handle" aria-hidden="true" />
  </DecorationRoot>
</template>
```

```ts
// image.ts
import { Decoration } from "wordgard/editor";
import { Image } from "wordgard/types";
import { createWrapper } from "@stesura/vue-wordgard";

import Resizer from "./Resizer.vue";

// An image is inline: a span around it.
export const imageConfig = Decoration.Tag.wrapper(
  Image,
  createWrapper(Resizer, { element: "span" })
);
```

- A wrapper can aim at an element inside the type's shape: `{ target: "img" }`.
- **One `Decoration.Tag.shape` per node type**: fold several features' components into one, or
  give each a wrapper or a tag widget.
- `createWrapper` can't wrap text, nor a node a native widget draws (draw it with a Vue widget).

### Handing a node data without drawing it

`nodeWrapper(Type, component)` is a component around every node of a type that renders **no
element**: its root is `<WrappedNode />`, the node's drawing, and the attributes it gives
`WrappedNode` fall through to the node's root element (a class, a style, a data attribute, even for
a node Wordgard draws). It hands a Vue shape data through `provide` and re-renders from its own
state without drawing the node again. Several on one type nest, the highest precedence outermost.
`nodeWrapper((type) => boolean, component)` wraps every type the function picks, defined at module
level. Put the wrappers in the configuration once: changing them draws the whole document again.

### Changing a node without remounting it

A component keeps its state while its node changes in place or moves within its parent; it
remounts when the node is replaced whole, changes type or moves to another parent.

- **Data an action changes in place** (size, a callout's kind): a mark on the tag,
  `Mark.Type.define(name, { target: NodeType, … })`, read with `node.tag.mark(Type)`, changed with
  `wg.dispatch({ changes: { from: pos, add: Type.of(v) } })` or `{ from: pos, remove: Type.of(v) }`.
- **What identifies the node** (an image's `src`, a heading's level): its parameter, changed by
  retagging the opening token, `{ from: pos, to: pos + 1, insert: [Heading.of(2)] }`.
- **Never** replace the whole node to change its data: that remounts the component.

### Composables inside Vue decorations

- `useNodePos()`: a function returning the position of what the decoration draws. Call it in
  handlers and `useEditorEffect`, not during setup or in `onMounted` (the tiles don't exist yet).
- `useIsNodeSelected()` (a `ref`), `useSelectNode(select, deselect?)`: the node selection.
- `useStopEvent((wg, event) => stop)`: asked for events in the decoration's chrome (its root and
  the elements around its content element) and in Vue widgets, never for those in its content. For
  an event it stops, Wordgard's handlers and keymaps are skipped and the browser's default goes
  ahead. Controls in chrome need it.
- `useIgnoreMutation((wg, record) => ignore)`: Wordgard doesn't read the DOM mutations it claims.

## Accessibility

- The editable element has `role="textbox"` and `aria-multiline`; give it a name (Setup).
- Chrome is read inline with the document's text: `aria-hidden` on decorative parts, a name on
  every control, controls wrapped in `useStopEvent` so Wordgard leaves their keys.

## Coming from react-wordgard

| react-wordgard                                                       | vue-wordgard                                              |
| -------------------------------------------------------------------- | --------------------------------------------------------- |
| `{children}` in `contentDOMRef`'s element                            | `<NodeContent as="…" />`, or `<DecorationRoot content />` |
| A wrapper's `{children}`                                             | `<WrappedNode />`                                         |
| `{...props}` and `ref` on a root drawn by hand                       | nothing: attributes fall through                          |
| `useEditorStateSelector(selector)`                                   | `computed` over `useEditorState()`                        |
| `useEditorEventCallback(callback)`                                   | a plain function using `useWordgard()`                    |
| `useEditorEffect(effect, deps)`                                      | `useEditorEffect(effect, source)`                         |
| `NodeRootProps` in a node wrapper                                    | attributes on its `<WrappedNode />`                       |
| `WordgardScope`, `useMergedDOMRefs`, `staticCopy`, `isTrailingBreak` | none                                                      |

## When something fails

- "A Vue shape's component must draw one element at its root (DecorationRoot, NodeContent or an
  element)" (or wrapper, mark): the root is a fragment, a component with several roots, or missing.
- "…drew <x> where its shape says <y>" (logged): draw the element the shape says (the node
  type's, or `element`), or pass the drawn one to the shape's `of`.
- "Vue's DOM has extra nodes", "…chrome is between its content's nodes", "…holds an empty text node
  or a comment beside its content": chrome or a `v-if` sits in a content element where it can't
  (see the contract).
- "DecorationRoot is the root of a Vue shape, wrapper, mark or widget", "NodeContent is the content
  of a Vue shape or mark", "WrappedNode is what a Vue wrapper or node wrapper wraps": used outside
  those components. "DecorationRoot holds the content of a Vue shape or mark only": `content` on a
  wrapper's or widget's root.
- "A Vue wrapper's component must draw a WrappedNode": a wrapper drew nothing where it wraps.
- "A Vue shape can't wrap: use createWrapper", "A Vue wrapper isn't a shape: use createShape": a
  factory's value went to the other decoration. "Not a Vue shape" (widget, mark): a React
  decoration in a Vue editor.
- "…is called outside a Vue shape, wrapper, mark or widget": a decoration composable used
  elsewhere. "…is used outside a Wordgard editor": an editor composable outside `WordgardEditor`.
- "This Vue shape or wrapper isn't drawn" (or widget, mark): `useNodePos()`'s function called
  during setup, in `onMounted` or after unmount.
- "A Vue wrapper can't wrap a native widget: draw … with a Vue widget", "A Vue wrapper can't wrap
  text".
- "This editor is already rendered by another WordgardDoc": one `WordgardDoc` per editor.
- "vue-wordgard can't render part of …": a shape or decoration it doesn't draw yet; the message
  names the node type.
- "Cannot dispatch new updates during the editor flush phase": a dispatch from
  `useEditorLayoutEffect` or a render; dispatch from an event handler or `useEditorEffect`.
- Two copies of `wordgard` (`npm ls wordgard`) break `instanceof` checks in odd places.
