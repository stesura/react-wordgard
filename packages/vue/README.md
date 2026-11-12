# vue-wordgard

> **Under construction.** vue-wordgard isn't ready for production yet, and its API may still
> change.

vue-wordgard stays on 0.x for as long as Wordgard does: it reaches into Wordgard's internals, and
into some of Vue's, so it can't be more stable than either.

A Vue view for [Wordgard](https://www.wordgard.net): Vue draws the Wordgard document in your app's
tree, and any decoration that takes a shape, a wrapper or a widget can be a Vue component. Wordgard
keeps doing the rest (input, selection, composition), and the API stays Wordgard's.

A Vue decoration draws its content with `<NodeContent>`, reads what your app provides and its
stores, and can re-render on its own without breaking the editor.

It is [react-wordgard](https://github.com/stesura/react-wordgard/tree/master/packages/react) for
Vue, over the same core. Its README goes deeper into Wordgard's side (shapes or wrappers, sharing
the model with a server, changing a node without remounting it); all of that holds here.

## Contents

- [Install](#install)
- [Usage](#usage)
  - [Reading and changing the editor](#reading-and-changing-the-editor)
  - [Vue decorations](#vue-decorations)
  - [The component's contract](#the-components-contract)
  - [Timing](#timing)
  - [Limits](#limits)
- [API](#api)
- [Coming from react-wordgard](#coming-from-react-wordgard)
- [AI coding agents](#ai-coding-agents)
- [Licence](#licence)

## Install

```sh
npm install @stesura/vue-wordgard wordgard vue
```

- `wordgard` 0.7.0 exactly: vue-wordgard uses Wordgard's internals, which any release can change.
- `vue` 3.5, from 3.5.45: vue-wordgard uses some of Vue's internals (`instance.update()`, a
  container's `_vnode`, `vnode.memo`), which a minor release can change.
- Only one copy of `wordgard` in your app: `npm ls wordgard` should list one version. With two, the
  editor won't work.
- vue-wordgard brings its core, `@stesura/wordgard-view`, at the same version: don't install or
  import it yourself.
- With TypeScript, `"skipLibCheck": true` in your `tsconfig.json`: Wordgard's own typings don't
  type-check ([#120](https://code.haverbeke.berlin/wordgard/wordgard/issues/120)).
- Keep Vue's Options API on (the default; `__VUE_OPTIONS_API__`): vue-wordgard has your components
  in the document commit inside Wordgard's update through a mixin. Without it they commit after,
  which works but costs an update.

## Usage

```vue
<!-- Editor.vue -->
<script setup lang="ts">
import { Decoration, Wordgard } from "wordgard/editor";
import { basicSchema, image } from "wordgard/schema";
import { Image } from "wordgard/types";
import { WordgardDoc, WordgardEditor, createShape } from "@stesura/vue-wordgard";

import ImageView from "./ImageView.vue";
import WordCount from "./WordCount.vue";

const config = [
  basicSchema(),
  image(),
  Decoration.Tag.shape(Image, createShape(ImageView)),
  Wordgard.label("Document"),
];
</script>

<template>
  <WordgardEditor
    doc='<p>Hello <strong>world</strong> <img src="/cat.png" alt="A cat"></p>'
    :config="config"
  >
    <WordCount />
    <WordgardDoc class="editor" />
  </WordgardEditor>
</template>
```

```vue
<!-- ImageView.vue: the node type's element, an <img>. Its attributes (`src`, `alt`, the selected
     node's class) fall through to the root. -->
<script setup lang="ts">
import { ref } from "vue";
import { DecorationRoot, type ShapeComponentProps } from "@stesura/vue-wordgard";

defineProps<ShapeComponentProps>();
const hover = ref(false);
</script>

<template>
  <DecorationRoot
    :style="hover ? { outline: '2px solid' } : undefined"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  />
</template>
```

```vue
<!-- WordCount.vue -->
<script setup lang="ts">
import { computed } from "vue";
import { useEditorState } from "@stesura/vue-wordgard";

const state = useEditorState();
const words = computed(() => state.value.doc.textContent().split(/\s+/).filter(Boolean).length);
</script>

<template>
  <output>{{ words }} words</output>
</template>
```

`<WordgardEditor>` creates the editor from its props (`doc`, `config`, `selection`, `state`), **read
once**: the editor owns its state, and you change it with `wg.dispatch(…)`, its configuration with
Wordgard's compartments. `<WordgardDoc>` puts it in the page, in a `div` taking its attributes; one
per editor. `WordgardEditor` draws no element: wrap as much of the page in it as needs the editor.

### Reading and changing the editor

Under `WordgardEditor`, inside the document or beside it:

- `useWordgard()`: the editor. Commands run through `Command.dispatch(wg, command)`, changes
  through `wg.dispatch({ changes, selection })`; `wg.state` is the latest state, dispatches not yet
  drawn included.
- `useEditorState()`: a `shallowRef` of the state as of the editor's last update (the one the DOM
  shows). Derive from it with `computed`.
- `useEditorField(field, select?, isEqual?)`: a `computed` of a state field's value, or a part of
  it; nothing runs on an update that leaves the field unchanged. `useEditorFieldEntry(field, key)`:
  one entry of a field holding a `Map`.
- `useEditorEffect((wg) => cleanup?, source?)`: runs once the editor's DOM is up to date, after it
  mounts and again when `source` (what `watch` takes) changes. It may read layout and dispatch: for
  focus, menus, follow-up dispatches.
- `useEditorLayoutEffect({ read, write })`: inside every update, `read` in Wordgard's read phase and
  `write` in its write phase, on the same paint, without rendering; it can't dispatch. For what
  moves with the text (margin markers, pagination).
- `useEditorEventListener(type, (wg, event) => handled)`: the editor's DOM events, before
  Wordgard's handlers and keymaps; returning `true` handles the event. Keyboard, input, mouse
  (not `mousemove`), focus, clipboard and drag-and-drop events.

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

Menus and popovers: position them with your library (Floating UI) from `wg.coordsAtPos(pos)` in
`useEditorEffect`, shown or hidden from a `computed` over the state. To react to changes without
rendering (autosave), add a `Wordgard.updateListener.of((update) => …)` to `config`. Components
outside `WordgardEditor` can't use the composables: lift `WordgardEditor`, or share the editor
through a store from `useEditorEffect` and use it directly.

### Vue decorations

Each factory takes a component, is **called at module level**, and returns a Wordgard value for
`config`:

| Need                                                      | Factory                                   | Passed to                                                                             |
| --------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------- |
| A node, with content or an atom (callout, image, mention) | `createShape(component)`                  | `Decoration.Tag.shape(Type, shape)`; `shape.of(element, { atom? })` for `Point.shape` |
| An element around a node or part of its shape             | `createWrapper(component, { element })`   | `Decoration.Tag.wrapper(Type, wrapper, { target? })`, `Decoration.Point.wrapper`      |
| A mark's element (link, comment highlight)                | `createMarkShape(component, { element })` | `Decoration.Mark.shape(MarkType, shape)`                                              |
| A widget at a position or beside a node (badge, mention)  | `createWidgetType({ component, … })`      | `Decoration.Point.widget(Type.of(value))`, `Decoration.Tag.widget`, `Tag.shape`       |
| Data for a node's shape, with no element                  | `nodeWrapper(Type, component)`            | `config` directly: it is an extension                                                 |

```vue
<!-- Callout.vue: a shape holding blocks, chrome before its content. -->
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
<!-- LinkMark.vue: a mark, its root the content element. -->
<script setup lang="ts">
import { DecorationRoot, type MarkComponentProps } from "@stesura/vue-wordgard";

defineProps<MarkComponentProps>();
</script>

<template>
  <DecorationRoot content :href="String(markProps.mark.value)" />
</template>
```

```vue
<!-- Resizer.vue: a wrapper, with a handle beside what it wraps. -->
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

```vue
<!-- Badge.vue: a widget. -->
<script setup lang="ts">
import { DecorationRoot } from "@stesura/vue-wordgard";

defineProps<{ value: string }>();
</script>

<template>
  <DecorationRoot class="badge" aria-hidden="true">{{ value }}</DecorationRoot>
</template>
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
} from "@stesura/vue-wordgard";

import Badge from "./Badge.vue";
import Callout from "./Callout.vue";
import LinkMark from "./LinkMark.vue";
import Resizer from "./Resizer.vue";

const BadgeWidget = createWidgetType<string>({ component: Badge });

export const view = [
  Decoration.Tag.shape(Blockquote, createShape(Callout)),
  Decoration.Mark.shape(Link, createMarkShape(LinkMark, { element: "a" })),
  // An image is inline: a span around it.
  Decoration.Tag.wrapper(Image, createWrapper(Resizer, { element: "span" })),
  Decoration.Tag.widget(Paragraph, "start", BadgeWidget.of("¶")),
];
```

Keep the model (node and mark types, schema elements, fields, commands) in a module without Vue,
which a server can import, and the Vue decorations in a client module adding decorations only.

`nodeWrapper(Type, component)` puts a component around every node of a type, rendering no element:
its root is `<WrappedNode />`, the node's drawing, and the attributes you give it fall through to
the node's root element. It hands the node's Vue shape data through `provide`, and re-renders from
its own state without drawing the node again. Changing the wrappers in the configuration draws the
whole document again.

Inside a decoration's component: `useNodePos()` (a function giving its position, for handlers and
effects), `useIsNodeSelected()` (a `ref`), `useSelectNode(select, deselect?)`,
`useStopEvent((wg, event) => stop)` for events in its chrome (its controls), and
`useIgnoreMutation((wg, record) => ignore)`.

### The component's contract

- **One root, the element the decoration says, kept.** For a shape, the node type's own outer
  element, per node (`h1` to `h6` for a heading); for `createWrapper`, `createMarkShape` and
  `.of(element)`, their `element` (`div` for wrappers, `span` for marks); for a widget, the type's
  `element` (`span`), or any element. Wordgard applies decorations to that element before Vue
  draws, so the component can't choose it. No `v-if`, `v-for` or `:key` on the root: replacing it
  breaks the editor.
- **`<DecorationRoot>`** draws that root. Or draw the element yourself: Wordgard's attributes
  (the node type's, the selection's `wg-selected-node`, tag and mark attributes) fall through to
  any single root, classes joined and styles merged with yours, Wordgard's winning for the rest.
  `inheritAttrs: false` drops them.
- **The content is `<NodeContent as="div" />`**, never a `<slot />`: a slot would put empty text
  nodes beside the text, where Wordgard reads positions. `<DecorationRoot content />` makes the root
  the content element; use it rather than switching between the two, which remounts the root.
  Without either, the node draws as an atom (a leaf, or `.of(element, { atom: true })`).
- **What a wrapper wraps is `<WrappedNode />`**, once, its attributes falling through to the
  wrapped element.
- Everything else the component draws is **chrome**: made uneditable, never read as content, free
  to change. In a textblock or a mark, the content element holds only the content; chrome beside a
  paragraph's text is a widget at its `"start"` or `"end"`. In a node holding blocks, chrome may sit
  before or after the content, in `NodeContent`'s `before` and `after` slots.
- `v-if` and fragments leave comments and empty text nodes: `DecorationRoot`'s slot and
  `NodeContent`'s slots drop them; a content element or a mark's elements holding one throws.
- Moving `<NodeContent>` or `<WrappedNode>` under another element remounts the content (a
  selection or IME composition in it ends).
- Node parameters: `nodeProps.node.tag.param` for a node with content, `node.param` for a leaf;
  data an action changes in place is a mark on the tag (`node.tag.mark(Type)`), changed with
  `wg.dispatch({ changes: { from: pos, add: Type.of(value) } })`, which keeps the component mounted.

### Timing

Wordgard updates the DOM in its flush, on the next frame, and Vue draws the document inside it.

- **Don't read the editor's layout (`coordsAtPos`) or force its update from a component's setup,
  render or hooks (`onMounted` included)**: the update is refused there and drawn on the next
  frame. Use `useEditorEffect`, `useEditorLayoutEffect` or an event handler.
- A document component's `onMounted` runs before Wordgard's tiles exist: `useNodePos()`'s function
  throws there; call it from handlers and `useEditorEffect`.
- Components outside the document render the state in Vue's next tick after the update, on the
  same paint; a test reading them waits for `nextTick`.
- An error a component in the document throws is logged; the next update draws the document again.

### Limits

- A Vue wrapper can't wrap text, or a node a native widget draws (draw it with a Vue widget).
- Functional components in the document commit after Wordgard's update, not inside it.
- Templates compiled in the browser need Vue's full build (`vue/dist/vue.esm-bundler.js`);
  single-file components don't.

## API

Everything is exported from `@stesura/vue-wordgard`.

- Components: `WordgardEditor`, `WordgardDoc`, `DecorationRoot`, `NodeContent`, `WrappedNode`.
- Factories: `createShape`, `createWrapper`, `createMarkShape`, `createWidgetType`, `nodeWrapper`.
- Editor composables, under `WordgardEditor`: `useWordgard`, `useEditorState`, `useEditorField`,
  `useEditorFieldEntry`, `useEditorEffect`, `useEditorLayoutEffect`, `useEditorEventListener`.
- Decoration composables, in a decoration's component: `useNodePos`, `useIsNodeSelected`,
  `useSelectNode`, `useStopEvent`, `useIgnoreMutation`.
- Props types: `ShapeComponentProps`, `WrapperComponentProps`, `MarkComponentProps`,
  `WidgetComponentProps`, `NodeWrapperComponentProps`.
- `VueWordgard.create(spec)`: an editor drawn by Vue outside a component tree (tests, benchmarks).
  In a Vue app, use `WordgardEditor`.

The composables' and components' signatures and details are in their typings
(`dist/index.d.ts`).

## Coming from react-wordgard

| react-wordgard                                                       | vue-wordgard                                              |
| -------------------------------------------------------------------- | --------------------------------------------------------- |
| `{children}` in `contentDOMRef`'s element                            | `<NodeContent as="…" />`, or `<DecorationRoot content />` |
| A wrapper's `{children}`                                             | `<WrappedNode />`                                         |
| `{...props}` and `ref` on a root drawn by hand                       | nothing: attributes fall through, the root is found       |
| `useEditorStateSelector(selector)`                                   | `computed(() => selector(useEditorState().value))`        |
| `useEditorEventCallback(callback)`                                   | a plain function using `useWordgard()`                    |
| `useEditorEffect(effect, deps)`                                      | `useEditorEffect(effect, source)`                         |
| `NodeRootProps` in a node wrapper                                    | attributes on its `<WrappedNode />`                       |
| `WordgardScope`, `useMergedDOMRefs`, `staticCopy`, `isTrailingBreak` | none                                                      |
| `useIsNodeSelected()` returning a boolean                            | `useIsNodeSelected()` returning a `ref`                   |

## AI coding agents

The package ships a skill for building editors with vue-wordgard: `skills/vue-wordgard/` (in
`node_modules/@stesura/vue-wordgard/`). Copy that folder into your project's `.claude/skills/`, or
point your agent to its `SKILL.md`.

## Licence

MIT, © 2026 Edoardo Caratti, see [LICENSE.txt](LICENSE.txt).

Includes code from react-prosemirror (© Handle with Care Collective and The New York Times
Company), through react-wordgard; its notices are in
[THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt). Its core, `@stesura/wordgard-view`, also
includes code from Wordgard (© Marijn Haverbeke).
