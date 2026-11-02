---
name: react-wordgard
description: Build rich text editors with Wordgard and react-wordgard in a React app. Use when creating or changing a Wordgard editor drawn by React - hosting it, drawing nodes, marks, wrappers or widgets as React components, reading the editor's state in components, positioning menus and popovers, handling the editor's events, or migrating react-prosemirror node views.
---

# Building editors with Wordgard and react-wordgard

react-wordgard is a React view for [Wordgard](https://wordgard.net/docs/), a rich text editor.
Wordgard runs the editor (document, state, input, selection, IME composition, decorations,
commands); react-wordgard has React draw its document, inside Wordgard's own update, in the app's
React tree, so the app's contexts reach what it draws. **The API is Wordgard's**: a customisation
is a Wordgard extension or decoration, and react-wordgard adds functions that let a React
component be the decoration.

Wordgard's own API: its docs (https://wordgard.net/docs/) and its typings in
`node_modules/wordgard/dist/*.d.ts` (`wordgard/editor`, `wordgard/state`, `wordgard/doc`,
`wordgard/schema`, `wordgard/types`, `wordgard/command`). react-wordgard's: its README and
`node_modules/react-wordgard/dist/index.d.ts`. Read them rather than guessing a signature.

## Setup

```sh
npm install react-wordgard wordgard react react-dom
```

- Peers: `wordgard` `~0.6.2` (react-wordgard uses its internals: only its patches), React 18 or 19.
  The app must have **one copy** of `wordgard`, or Wordgard's `instanceof` checks fail.
- TypeScript: Wordgard's typings need `skipLibCheck: true`.
- Name the editor for screen readers with `Wordgard.contentAttributes.of({ "aria-label": "…" })`
  in the config (`Wordgard.label` names the wrong element in 0.6.2).

## Hosting the editor

```tsx
import { WordgardDoc, WordgardEditor } from "react-wordgard";
import { basicSchema } from "wordgard/schema";

export const Editor = () => (
  <WordgardEditor doc="<p>Hello</p>" config={[basicSchema()]}>
    <Toolbar />
    <WordgardDoc className="editor" />
  </WordgardEditor>
);
```

- `WordgardEditor` takes a `Wordgard.Spec` (`doc` as HTML, `config` as extensions, or a `state`),
  **read once**: the editor is uncontrolled and owns its state. Change the document through
  `wg.dispatch(…)`, the configuration through Wordgard's compartments or
  `GardState.appendConfig`, never by re-rendering with new props.
- `WordgardDoc` puts the editor in the page; one per editor. Components inside `WordgardEditor`
  (toolbars, menus, sidebars) can use the hooks.
- Don't create editors with `Wordgard.create` for a React app: react-wordgard's editor is made by
  `WordgardEditor`.

## Reading and changing the editor from components

```tsx
import { Command, toggleStrong } from "wordgard/command";
import { useEditorEventCallback, useEditorStateSelector } from "react-wordgard";

const Toolbar = () => {
  const empty = useEditorStateSelector((state) => state.selection.empty);
  const bold = useEditorEventCallback((wg) => Command.dispatch(wg, toggleStrong));
  return (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        bold();
      }}
    >
      Bold
    </button>
  );
};
```

- `useWordgard()`: the editor (`wg`).
- `useEditorState()`, `useEditorStateSelector(selector, isEqual?)`: the state as of the editor's
  last update (the one the DOM shows). Prefer the selector: the component re-renders only when its
  result changes (`Object.is`, or `isEqual`).
- `useEditorEventCallback((wg, ...args) => …)`: a stable callback getting the editor, for event
  handlers. Commands run through `Command.dispatch(wg, command, param?)`; plain changes through
  `wg.dispatch({ changes: { from, to, insert }, selection })`.
- `useEditorEventListener(type, (wg, event) => handled)`: the editor's DOM events of `type`, before
  Wordgard's handlers and keymaps; return `true` to handle the event (Wordgard then calls
  `preventDefault`). Types: `keydown`, `keyup`, `keypress`, `beforeinput`, `input`, composition
  events, `mousedown`, `mouseup`, `mouseover`, `mouseout`, `click`, `dblclick`, `contextmenu`,
  `focus`, `blur`, `copy`, `cut`, `paste`, drag-and-drop events. Key events during an IME
  composition don't come.

### Effects and layout

Wordgard drives the update and React draws inside it, so there are two effect hooks:

| Hook                                                                      | Runs                                                                             | May dispatch             | What it sets shows | For                                                  |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------ | ------------------ | ---------------------------------------------------- |
| `useEditorEffect((wg) => cleanup?, deps)`                                 | after the editor's update                                                        | yes                      | a frame later      | focusing, follow-up dispatches, menus                |
| `useEditorLayoutEffect({ read: (wg) => value, write: (value, wg) => … })` | inside every update: `read` in Wordgard's read phase, `write` in its write phase | **no** (Wordgard throws) | on the same paint  | what moves with the text: margin markers, pagination |

- **Never read the editor's layout (`coordsAtPos`, `posAtCoords`) in a plain React `useEffect` or
  `useLayoutEffect`**: it runs inside Wordgard's update, before the view of the new DOM exists, and
  react-wordgard refuses the update. Use one of the two hooks above.
- Menus and popovers: position them with your popover library (Floating UI, Radix, Base UI) from a
  virtual anchor built from `wg.coordsAtPos(pos)` in `useEditorEffect`; show or hide them from
  `useEditorStateSelector`. Wordgard's own tooltips and panels also work, as plain DOM.

## Drawing parts of the document with React

Prefer Wordgard's declarative shapes (`Elt` shapes, `Decoration.Tag.attribute`, mark shapes) for
anything that needs no code: React draws them all already. Use a React component where a part needs
state, interaction or the app's contexts. Each factory below is **called once, at module level**,
and returns a Wordgard value you pass in `config`. The components need no memoizing: React draws a
node again only when it changed, or from the component's own state, contexts and hooks.

| Need                                                         | Factory                                   | Passed to                                                                        |
| ------------------------------------------------------------ | ----------------------------------------- | -------------------------------------------------------------------------------- |
| A node, with content or an atom (callout, image, mention)    | `createShape(component)`                  | `Decoration.Tag.shape(Type, shape)`; `shape.of(element)` for `Point.shape`       |
| An element around a node or part of its shape                | `createWrapper(component, { element })`   | `Decoration.Tag.wrapper(Type, wrapper, { target? })`, `Decoration.Point.wrapper` |
| A mark's element (link, comment highlight)                   | `createMarkShape(component, { element })` | `Decoration.Mark.shape(MarkType, shape)`                                         |
| A widget at a position or beside a node (placeholder, badge) | `createWidgetType({ component, … })`      | `Decoration.Point.widget(MyType.of(value), { side })`, `Decoration.Tag.widget`   |

```tsx
import { forwardRef } from "react";
import { Decoration } from "wordgard/editor";
import { basicSchema, blockquote, image } from "wordgard/schema";
import { Blockquote, Image, Link } from "wordgard/types";
import {
  type MarkComponentProps,
  type ShapeComponentProps,
  createMarkShape,
  createShape,
} from "react-wordgard";

const CalloutShape = createShape(
  forwardRef<HTMLQuoteElement, ShapeComponentProps<HTMLQuoteElement>>(function Callout(
    { nodeProps: { contentDOMRef }, children, ...attrs },
    ref
  ) {
    return (
      <blockquote {...attrs} ref={ref}>
        <span aria-hidden="true">!</span>
        <div ref={contentDOMRef}>{children}</div>
      </blockquote>
    );
  })
);

const LinkMark = createMarkShape(
  forwardRef<HTMLAnchorElement, MarkComponentProps<HTMLAnchorElement>>(function LinkMark(
    { markProps: { mark, contentDOMRef }, children, ...attrs },
    ref
  ) {
    return (
      <a {...attrs} ref={ref} href={String(mark.value)}>
        <span ref={contentDOMRef}>{children}</span>
      </a>
    );
  }),
  { element: "a" }
);

// An atom: no content, everything it draws is chrome.
const PictureShape = createShape(
  forwardRef<HTMLImageElement, ShapeComponentProps<HTMLImageElement>>(function Picture(
    { nodeProps, children, ...attrs },
    ref
  ) {
    return <img {...attrs} ref={ref} />;
  })
);

export const config = [
  basicSchema(),
  blockquote(),
  image(),
  Decoration.Tag.shape(Blockquote, CalloutShape),
  Decoration.Mark.shape(Link, LinkMark),
  Decoration.Tag.shape(Image, PictureShape),
];
```

An image's `src` comes in `attrs` (its type's own attributes), and its `alt` from the `ImageAlt`
mark, as an attribute. Check the parameter types of the node and mark types you use in
`wordgard/types`.

### The component's contract

- **The root is the element the decoration says, and stays that element.** For a shape, that's
  the node type's own outer element, per node (`h1` to `h6` for a heading); for `.of`,
  `createWrapper` and `createMarkShape`, their `element` (`div` for wrappers, `span` for marks, by
  default). Wordgard applies decorations to the shape before React draws (`target` selectors
  match its tag), so the tag can't come from the component. Re-render freely, but don't swap the
  root for another element.
- **Only the outer element comes from the node type.** The elements inside a structure shape (a
  figure's `img`) are the component's to draw, from `nodeProps.node`; attributes aimed at them
  (`ImageAlt` on a figure) arrive on the root, in `attrs`.
- **Give the ref to the root element.** React 19 passes `ref` as a prop; on React 18 the component
  needs `forwardRef` (as in the examples, which work on both).
- **Spread the attributes (`...attrs`) onto the root.** They carry the node type's own attributes,
  Wordgard's selection classes (`wg-selected-node`, `wg-selected-cell`) and tag, point and mark
  attributes (an image's `alt`). Wordgard has already merged the decorations' attributes into one
  `className` and one `style`: a component setting its own merges them with those, or one
  replaces the other.
- **Content goes where `contentDOMRef` points**, else in the root. `children` is the content (a
  wrapper's `children` is what it wraps; no `contentDOMRef` there).
- **An atom** (a leaf, or a plot whose shape has no hole) has no content: `children` is empty,
  and a `contentDOMRef` throws. `.of(element, { atom: true })` has no hole: a leaf needs it (for
  `Decoration.Point.shape` before a leaf), and it draws a plot as an atom.
- Everything else the component draws is **chrome**: made uneditable, never read as document
  content, free to change from the component's state, a context or a store.
  - In a textblock (a paragraph-like node) or a mark, the content element holds only the content.
  - In a node holding blocks, chrome may sit before or after the content in its element, not
    between the content's nodes.
  - Moving `{children}` under another element remounts the content (a selection or IME
    composition in it ends).
- Node parameters: `nodeProps.node.tag.param` for a node with content, `node.param` for a leaf;
  `markProps.mark` is the document's mark (`mark.value`).
- `createWrapper` can't wrap a node a native widget draws (draw it with a React shape or widget), nor text.

### Hooks inside React decorations

- `useNodePos()`: a function returning the position of what the decoration draws (call it in
  handlers and effects, not during render).
- `useIsNodeSelected()`, `useSelectNode(select, deselect?)`: the node selection.
- `useStopEvent((wg, event) => stop)`: Wordgard ignores the events it stops in the decoration's
  chrome or a React widget (inputs, buttons in a title bar), and their default goes ahead.
- `useIgnoreMutation((wg, record) => ignore)`: Wordgard doesn't read the DOM mutations it claims
  (typing aside: Wordgard takes it from `beforeinput`).
- `useMergedDOMRefs(...refs)`: one ref setting several (the forwarded `ref` and `contentDOMRef`
  on one element, a measuring ref).

## Accessibility

- The editable element has `role="textbox"` and `aria-multiline`; give it a name (Setup).
- Chrome is read inline with the document's text: `aria-hidden` on decorative parts, a name on
  every control, controls focusable and wrapped in `useStopEvent` so Wordgard leaves their keys.

## Migrating react-prosemirror node views

| react-prosemirror                                                                                                       | react-wordgard                                                                   |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `<ProseMirror state dispatchTransaction>`                                                                               | `<WordgardEditor doc config>`, uncontrolled; changes via `wg.dispatch`           |
| `<ProseMirrorDoc />`                                                                                                    | `<WordgardDoc />`                                                                |
| `nodeViews`                                                                                                             | `Decoration.Tag.shape(Type, createShape(component))` in `config`, atoms included |
| `markViews`                                                                                                             | `createMarkShape` with `Decoration.Mark.shape`                                   |
| `NodeViewComponentProps`                                                                                                | `ShapeComponentProps` (same `nodeProps`, `contentDOMRef`, `children`, `ref`)     |
| `node.attrs`                                                                                                            | `node.tag.param` (or `node.param` for a leaf)                                    |
| `view` in callbacks                                                                                                     | `wg`                                                                             |
| `ProseMirror-selectednode`, `selectedCell`                                                                              | `wg-selected-node`, `wg-selected-cell`                                           |
| `useNodePos()` returning a number                                                                                       | `useNodePos()` returning a function                                              |
| `useEditorEffect` for same-paint layout                                                                                 | `useEditorLayoutEffect`                                                          |
| `useStopEvent`, `useIgnoreMutation`, `useSelectNode`, `useIsNodeSelected`, `useEditorEventListener`, `useMergedDOMRefs` | the same names, the editor first in callbacks                                    |
| `innerDecorations`, `useIsComposingIn`, `useIsEditorStatic`                                                             | none                                                                             |

ProseMirror's model maps to Wordgard's in its migration guide:
https://wordgard.net/docs/prosemirror/

## When something fails

- "…must forward its ref to its root element": the component doesn't pass `ref` to its root.
- "…drew <x> where its shape says <y>": draw the element the shape says (the node type's, or
  `element`), or pass the drawn one to the shape's `of`.
- "React's DOM has extra nodes" or "…chrome is between its content's nodes": chrome sits in a
  content element where it can't (see the contract).
- "ReactWordgard can't update while React renders or commits": layout was read from a plain React
  effect; use `useEditorEffect` or `useEditorLayoutEffect`.
- "Cannot dispatch new updates during the editor flush phase": a dispatch from
  `useEditorLayoutEffect` or a render; dispatch from an event handler or `useEditorEffect`.
- Two copies of `wordgard` (`npm ls wordgard`) break `instanceof` checks in odd places.
