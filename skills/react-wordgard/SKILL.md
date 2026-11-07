---
name: react-wordgard
description: Build rich text editors with Wordgard and react-wordgard in a React app. Use whenever the work involves Wordgard or react-wordgard - writing, reviewing, debugging or discussing code that uses them, or working on react-wordgard itself. Covers hosting the editor, drawing nodes, marks, wrappers or widgets as React components, reading the editor's state in components, positioning menus and popovers, handling the editor's events, and migrating react-prosemirror node views.
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
`node_modules/@stesura/react-wordgard/dist/index.d.ts`. Read them rather than guessing a signature.

**New to Wordgard, or porting ProseMirror code?** Read `references/wordgard.md`, next to this file:
Wordgard's model (plots, leaves, tags, marks on tags), changes, configuration, commands and the
editor, each against its ProseMirror counterpart, with the traps.

## Setup

```sh
npm install @stesura/react-wordgard wordgard react react-dom
```

- Peers: `wordgard` `~0.6.2` (react-wordgard uses its internals: only its patches), React 18 or 19.
  The app must have **one copy** of `wordgard`, or Wordgard's `instanceof` checks fail.
- TypeScript: Wordgard's typings need `skipLibCheck: true`.
- Name the editor for screen readers with `Wordgard.contentAttributes.of({ "aria-label": "…" })`
  in the config (`Wordgard.label` names the wrong element in 0.6.2).

## Hosting the editor

```tsx
import { WordgardDoc, WordgardEditor } from "@stesura/react-wordgard";
import { basicSchema } from "wordgard/schema";

export const Editor = () => (
  <WordgardEditor doc="<p>Hello</p>" config={[basicSchema()]}>
    <WordgardDoc className="editor" />
  </WordgardEditor>
);
```

- `WordgardEditor` takes a `Wordgard.Spec` (`doc` as HTML, `config` as extensions, or a `state`),
  **read once**: the editor is uncontrolled and owns its state. Change the document through
  `wg.dispatch(…)`, the configuration through Wordgard's compartments or
  `GardState.appendConfig`, never by re-rendering with new props.
- `WordgardDoc` puts the editor in the page; one per editor. Components inside `WordgardEditor`
  (toolbars, menus, sidebars, next to `WordgardDoc`) can use the hooks: below. `WordgardEditor`
  draws no DOM, so wrap as much of the page in it as needs the editor.
- Don't create editors with `Wordgard.create` for a React app: react-wordgard's editor is made by
  `WordgardEditor`. In StrictMode (development) it creates the editor twice and drops one, which is
  never put in the page.

## Reading and changing the editor from components

```tsx
import { Command, toggleStrong } from "wordgard/command";
import { useEditorEventCallback, useEditorStateSelector } from "@stesura/react-wordgard";

const Toolbar = () => {
  const empty = useEditorStateSelector((state) => state.selection.empty);
  const bold = useEditorEventCallback((wg) => Command.dispatch(wg, toggleStrong));
  return (
    <button
      disabled={empty}
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
- `useEditorField(field, select?, isEqual?)`: a state field's (or derived field's) value, or a part
  of it. Prefer it to a selector reading a field: it compares the field once per update and runs
  nothing when the field didn't change, where every `useEditorStateSelector` runs on every update.
  `useEditorFieldEntry(field, key)` reads one entry of a field holding a `Map` (per-node data) and
  re-renders only when that entry changes. The field must be in the editor's configuration
  (`state.field` throws otherwise); a `Field.Derived` keeps its identity only if its compute
  returns the same object (memoize it, or pass `compare`).
- `useEditorEventCallback((wg, ...args) => …)`: a stable callback getting the editor, for event
  handlers. Commands run through `Command.dispatch(wg, command, param?)`; plain changes through
  `wg.dispatch({ changes: { from, to, insert }, selection })`.
- `useEditorEventListener(type, (wg, event) => handled)`: the editor's DOM events of `type`, before
  Wordgard's handlers and keymaps; return `true` to handle the event (Wordgard then calls
  `preventDefault`). Types: `keydown`, `keyup`, `keypress`, `beforeinput`, `input`, composition
  events, `mousedown`, `mouseup`, `mouseover`, `mouseout`, `click`, `dblclick`, `contextmenu`,
  `focus`, `blur`, `copy`, `cut`, `paste`, drag-and-drop events. Key events during an IME
  composition don't come. Handling `input`, `beforeinput` or a composition event skips Wordgard's
  own handling of it: leave typing to Wordgard. Touch, wheel, pointer events and `mousemove` aren't
  offered (they'd make every editor's listener non-passive or busy): for those, add a
  `Wordgard.domEventHandler` to `config`, or a listener on `wg.contentDOM` from `useEditorEffect`.
- `wg.state` in a callback is the latest state, dispatches not yet drawn included. To save the
  document: `wg.state.doc.toJSON()`; to load it, `state.schema.docFromJSON(json)` as `doc`.

### Reaching the editor from outside its `WordgardEditor`

The editor owns its state: there's no controlled `state` prop to lift into React, as with
react-prosemirror. The hooks throw outside `WordgardEditor`. Two ways:

1. **Lift `WordgardEditor`** over everything that needs the editor (it draws no DOM; the document
   goes where `WordgardDoc` is). Prefer this.
2. **Share the editor through a store** where it can't wrap the component (another part of the
   app, a portal): a component under `WordgardEditor` puts the editor in the store from
   `useEditorEffect`, and the component outside reads it and uses `wg` directly (not the hooks).

```tsx
import { atom, useAtomValue, useSetAtom } from "jotai";
import type { Wordgard } from "wordgard/editor";
import { basicSchema } from "wordgard/schema";
import { WordgardDoc, WordgardEditor, useEditorEffect } from "@stesura/react-wordgard";

const editorAtom = atom<Wordgard | null>(null);

const ShareEditor = () => {
  const setEditor = useSetAtom(editorAtom);
  useEditorEffect((wg) => {
    setEditor(wg);
    return () => setEditor(null);
  }, []);
  return null;
};

const SaveButton = () => {
  const wg = useAtomValue(editorAtom);
  const save = () => {
    if (wg) localStorage.setItem("doc", JSON.stringify(wg.state.doc.toJSON()));
  };
  return (
    <button onClick={save} disabled={!wg}>
      Save
    </button>
  );
};

export const App = () => (
  <>
    <header>
      <SaveButton />
    </header>
    <WordgardEditor doc="<p>Hello</p>" config={[basicSchema()]}>
      <ShareEditor />
      <WordgardDoc />
    </WordgardEditor>
  </>
);
```

Any store works (Jotai here, Zustand, `useSyncExternalStore`). A sub-editor (a header's, a note's)
is its own `WordgardEditor`, often drawn inside a React shape of the main one; a toolbar acting on
whichever editor has focus keeps the focused one in such a store, set from
`useEditorEventListener("focus", …)` in each.

To react to changes without re-rendering (autosave, a debounced copy), add a
`Wordgard.updateListener.of((update) => …)` to `config`; `update.docChanged` and `update.state`
tell what changed. `config` is read once, so it should write to a store, not close over a
component's state.

### Effects and layout

Wordgard drives the update and React draws inside it, so there are two effect hooks:

| Hook                                                                      | Runs                                                                             | May dispatch             | What it sets shows | For                                                  |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------ | ------------------ | ---------------------------------------------------- |
| `useEditorEffect((wg) => cleanup?, deps)`                                 | after the editor's update                                                        | yes                      | a frame later      | focusing, follow-up dispatches, menus                |
| `useEditorLayoutEffect({ read: (wg) => value, write: (value, wg) => … })` | inside every update: `read` in Wordgard's read phase, `write` in its write phase | **no** (Wordgard throws) | on the same paint  | what moves with the text: margin markers, pagination |

- **Never read the editor's layout (`coordsAtPos`, `posAtCoords`) in a plain React `useEffect` or
  `useLayoutEffect`**: it runs inside Wordgard's update, before the view of the new DOM exists, and
  react-wordgard refuses the update. Use one of the two hooks above.
- `useEditorLayoutEffect`'s `read` runs on every update: return `undefined` when nothing changed,
  which skips the write and, when no read asks for one, Wordgard's second measure. Reads run in
  registration order; an engine with ordered parts (pagination) registers one effect and drives
  them.
- Menus and popovers: position them with your popover library (Floating UI, Radix, Base UI) from a
  virtual anchor built from `wg.coordsAtPos(pos)` in `useEditorEffect`; show or hide them from
  `useEditorStateSelector`. Wordgard's own tooltips and panels also work, as plain DOM.

## Drawing parts of the document with React

**Keep the model apart from React.** A server (collaboration, AI, export) loads documents with
the client's schema and fields, and throws on a type its schema lacks. Define node and mark types,
schema elements, fields, commands and keys in a module without React that both sides import, and
React decorations in a client module that imports those types and adds decorations only (no schema
element, no field). Never define a type in the file holding its React shape. README: "Sharing the
model with a server".

Prefer Wordgard's declarative shapes (`Elt` shapes, `Decoration.Tag.attribute`, mark shapes) for
anything that needs no code: React draws them all already. Use a React component where a part needs
state, interaction or the app's contexts. Each factory below is **called at module level**, with a
component defined there, and returns a Wordgard value you pass in `config`. `createShape`,
`createWrapper` and `createMarkShape` return the same value for the same component, so composing
the config again (per editor) is safe; a component created inside a render is new each time. The
components need no memoizing: React draws a node again only when it changed, or from the
component's own state, contexts and hooks.

| Need                                                         | Factory                                   | Passed to                                                                             |
| ------------------------------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------- |
| A node, with content or an atom (callout, image, mention)    | `createShape(component)`                  | `Decoration.Tag.shape(Type, shape)`; `shape.of(element, { atom? })` for `Point.shape` |
| An element around a node or part of its shape                | `createWrapper(component, { element })`   | `Decoration.Tag.wrapper(Type, wrapper, { target? })`, `Decoration.Point.wrapper`      |
| A mark's element (link, comment highlight)                   | `createMarkShape(component, { element })` | `Decoration.Mark.shape(MarkType, shape)`                                              |
| A widget at a position or beside a node (placeholder, badge) | `createWidgetType({ component, … })`      | `Decoration.Point.widget(MyType.of(value), { side })`, `Decoration.Tag.widget`        |

```tsx
import { Decoration } from "wordgard/editor";
import { basicSchema, blockquote, image } from "wordgard/schema";
import { Blockquote, Image, Link } from "wordgard/types";
import { DecorationRoot, createMarkShape, createShape } from "@stesura/react-wordgard";

const CalloutShape = createShape(function Callout({ nodeProps: { contentDOMRef }, children }) {
  return (
    <DecorationRoot>
      <span aria-hidden="true">!</span>
      <div ref={contentDOMRef}>{children}</div>
    </DecorationRoot>
  );
});

const LinkMark = createMarkShape(
  function LinkMark({ markProps: { mark, contentDOMRef }, children }) {
    return (
      <DecorationRoot href={String(mark.value)}>
        <span ref={contentDOMRef}>{children}</span>
      </DecorationRoot>
    );
  },
  { element: "a" }
);

// An atom: no content, everything it draws is chrome.
const PictureShape = createShape(function Picture() {
  return <DecorationRoot />;
});

export const config = [
  basicSchema(),
  blockquote(),
  image(),
  Decoration.Tag.shape(Blockquote, CalloutShape),
  Decoration.Mark.shape(Link, LinkMark),
  Decoration.Tag.shape(Image, PictureShape),
];
```

An image's `src` is its type's own attribute and its `alt` the `ImageAlt` mark's: `DecorationRoot`
puts both on the `<img>`. Check the parameter types of the node and mark types you use in
`wordgard/types`.

### The component's contract

- **The root is the element the decoration says, and stays that element.** For a shape, that's
  the node type's own outer element, per node (`h1` to `h6` for a heading); for `.of`,
  `createWrapper` and `createMarkShape`, their `element` (`div` for wrappers, `span` for marks, by
  default). Wordgard applies decorations to the shape before React draws (`target` selectors
  match its tag), so the tag can't come from the component. Re-render freely, but don't swap the
  root for another element.
- **Draw it with `<DecorationRoot>`**, once, at the component's root. It renders that tag with
  Wordgard's attributes (the node type's own, the selection classes `wg-selected-node` and
  `wg-selected-cell`, tag, point and mark attributes, `contenteditable` on an atom) and the root's
  ref. Its own props win, except `className`, joined with Wordgard's, and `style`, merged (its
  keys winning); its `ref` gets the root too. It works on React 18 and 19 without `forwardRef`.
  Widgets use it too (see "React widgets").
- **Or draw the root by hand**, for more control over the decoration's attributes (drop or change
  one, type the root as its element): the element the decoration says, `{...props}` (Wordgard's
  attributes) and `ref` (`forwardRef` on React 18), never both ways at once. Join your classes with
  `className` (Wordgard's, the selection's among them), and spread your style over `style`
  (Wordgard's, as an object). On React 19, `ref` is a prop:

  ```tsx
  const ImageShape = createShape<HTMLImageElement>(function ImageShape({
    nodeProps,
    children,
    className,
    style,
    ref,
    ...props
  }) {
    return (
      <img
        {...props}
        ref={ref}
        className={["picture", className].join(" ").trim()}
        style={{ ...style, outline: "1px solid" }}
      />
    );
  });
  ```

  On React 18, with `forwardRef`:

  ```tsx
  const ImageShape = createShape(
    forwardRef<HTMLImageElement, ShapeComponentProps<HTMLImageElement>>(function ImageShape(
      { nodeProps, children, className, style, ...props },
      ref
    ) {
      return (
        <img
          {...props}
          ref={ref}
          className={["picture", className].join(" ").trim()}
          style={{ ...style, outline: "1px solid" }}
        />
      );
    })
  );
  ```

- **Only the outer element comes from the node type.** The elements inside a structure shape (a
  figure's `img`) are the component's to draw, from `nodeProps.node`; attributes aimed at them
  arrive on the root (see "Should I use a shape, a wrapper or both?").
- **Content goes where `contentDOMRef` points**, else in the root. `children` is the content (a
  wrapper's `children` is what it wraps; no `contentDOMRef` there).
- **An atom** (a leaf, or a plot whose shape has no hole) has no content: `children` is empty,
  and a `contentDOMRef` throws. `.of(element, { atom: true })` has no hole: a leaf needs it (for
  `Decoration.Point.shape` before a leaf), and it draws a plot as an atom.
- Everything else the component draws is **chrome**: made uneditable, never read as document
  content, free to change from the component's state, a context or a store.
  - In a textblock (a paragraph-like node) or a mark, the content element holds only the content.
    Chrome beside a textblock's text (line numbers) is a React widget at its `"start"` or `"end"`:
    `Decoration.Tag.widget(Paragraph, "start", LineNumber.of(null))` (see "React widgets").
  - In a node holding blocks, chrome may sit before or after the content in its element, not
    between the content's nodes.
  - Moving `{children}` under another element remounts the content (a selection or IME
    composition in it ends).
- Node parameters: `nodeProps.node.tag.param` for a node with content, `node.param` for a leaf;
  `markProps.mark` is the document's mark (`mark.value`).
- `createWrapper` can't wrap a node a native widget draws (draw it with a React shape or widget), nor text.
- **Don't write attributes on document elements by hand.** On a React decoration's root they
  survive only until React sets that attribute (a `classList.add` is lost when the selection
  changes `className`); on elements Wordgard draws they're undone at the next update. Put the
  state in the component (`data-resizing={resizing}`), or in a decoration from a state field.

### React widgets

```tsx
import { Decoration } from "wordgard/editor";
import { Paragraph } from "wordgard/types";
import {
  DecorationRoot,
  type WidgetComponentProps,
  createWidgetType,
} from "@stesura/react-wordgard";

// The root is a DecorationRoot, a <span> unless the spec gives an `element`.
const Badge = createWidgetType({
  component: function Badge({ value }: WidgetComponentProps<string>) {
    return (
      <DecorationRoot className="badge" aria-hidden="true">
        {value}
      </DecorationRoot>
    );
  },
});

export const badges = [
  Decoration.Tag.widget(Paragraph, "start", Badge.of("¶")),
  Decoration.Point.source.of(() =>
    Decoration.Point.set([[Decoration.Point.widget(Badge.of("!")), 1]])
  ),
];
```

- `createWidgetType({ component, element?, eq?, editable?, inFlow?, propagateEvent?, connect?,
disconnect? })` returns a real `Widget.Type`: its widgets are `Type.of(value)`. The component
  gets `value`.
- **Draw its root with `<DecorationRoot>`**: `element` (`span` by default), the ref, and the
  node's attributes for a widget drawing a node. Or by hand: any element, with the `ref` the
  component gets (`forwardRef` on React 18), which it **must** put on its root.
- Widgets are uneditable unless their spec sets `editable`, as in Wordgard. A React widget
  re-renders freely while it keeps its root element.
- A widget drawing a node (`Decoration.Tag.shape(Type, (tag) => W.of(tag.param))`):
  `DecorationRoot` puts the node's attributes on its root; a root drawn by hand gets them as
  props, to spread. A React shape is the usual way to draw a node.
- A widget's component may read a context a React shape around it provides (line numbers beside a
  paragraph's text, from the paragraph's shape).

### Should I use a shape, a wrapper or both?

A shape draws the node; a wrapper adds React around it. Unlike a ProseMirror node view, which picks
all its DOM, a node's outer element comes from its type's shape in the schema: Wordgard applies
marks and decorations to that shape (`target`, `preferTarget`) before React draws. A React shape
that draws more than its root gets the attributes aimed inside it on its root (a figure drawing its
own `img` gets `ImageAlt` and `ImageSize` on the `<figure>`). So the shape's root matches the node
type's element (`DecorationRoot`, or a root drawn by hand), and chrome around it is a wrapper:

```tsx
import { Decoration } from "wordgard/editor";
import { Image } from "wordgard/types";
import { DecorationRoot, createShape, createWrapper, useStopEvent } from "@stesura/react-wordgard";

// The shape draws the <img>, which keeps its src, alt and width.
const ImageShape = createShape(function ImageShape() {
  return <DecorationRoot className="image" />;
});

// The wrapper draws the resize handle around it.
const Resizer = createWrapper(
  function Resizer({ children }) {
    useStopEvent(() => true);
    return (
      <DecorationRoot className="resizer">
        {children}
        <span className="resize-handle" aria-hidden="true" />
      </DecorationRoot>
    );
  },
  { element: "span" } // an image is inline
);

export const imageConfig = [
  Decoration.Tag.shape(Image, ImageShape),
  Decoration.Tag.wrapper(Image, Resizer),
];
```

- A wrapper can also aim at an element inside the type's shape:
  `Decoration.Tag.wrapper(Figure, createWrapper(Frame), { target: "img" })`.
- A shape and wrappers on the same type apply to all its nodes. A table: a React shape drawing
  `table > tbody > {children}`, plus a wrapper for a scroll container around it.
- **One `Decoration.Tag.shape` per node type** draws it: where several features draw the same type
  (react-prosemirror apps merging node views), fold their components into one in the app's code
  and register that, or give each feature a wrapper or a tag widget of its own.
- Porting a react-prosemirror node view that draws chrome around the node's own element: keep the
  type's shape (or a React shape for the element), and move the chrome into a wrapper.

### Changing a node without remounting it

A component keeps its state while its node changes in place or moves within its parent; it
remounts, with everything inside, when the node is replaced whole, changes type or moves to another
parent.

- **Data an action changes in place** (size, alignment, a callout's kind, a table's widths): a mark
  on the tag, `Mark.Type.define(name, { target: NodeType, … })`, read with
  `node.tag.mark(Type)`, changed with `wg.dispatch({ changes: { from: pos, add: Type.of(v) } })`
  or `{ from: pos, remove: Type.of(v) }`. It merges in collaboration and inverts in history.
- **What identifies the node** (an image's `src`, a heading's level): its parameter, changed by
  retagging the opening token, `{ from: pos, to: pos + 1, insert: [Heading.of(2)] }`.
- **Never** replace the whole node (`{ from, to, insert: [node] }`) to change its data: that
  remounts the component.
- ProseMirror's `setNodeAttribute` / `setNodeMarkup` port to one of the first two.
- **Moving a node**: delete it and insert the same node object elsewhere in the same parent, in one
  transaction (`changes: [{ from, to: from + node.length }, { from: target, insert: [node] }]`).
  A copy (a new object, or one inserted while the original stays) mounts anew. React moves the
  DOM, so an `<iframe>` in a moved node reloads. Wordgard's drag-and-drop rebuilds what it drops
  from HTML: those moves remount.

### Hooks inside React decorations

- `useNodePos()`: a function returning the position of what the decoration draws (call it in
  handlers and effects, not during render).
- `useIsNodeSelected()`, `useSelectNode(select, deselect?)`: the node selection.
- `useStopEvent((wg, event) => stop)`: asked for events in the decoration's chrome (inputs,
  buttons in a title bar), on its own elements (its root and the elements around its content
  element: an atom's root, a frame's padding; not a root that is itself the content element) and
  in React widgets. Never for events in the content, unlike react-prosemirror. For an event it
  stops, Wordgard's handlers and keymaps are skipped and the browser's default goes ahead.
- `useIgnoreMutation((wg, record) => ignore)`: Wordgard doesn't read the DOM mutations it claims
  (typing aside: Wordgard takes it from `beforeinput`).
- `useMergedDOMRefs(...refs)`: one ref setting several (the forwarded `ref` and `contentDOMRef`
  on one element, a measuring ref).

## Accessibility

- The editable element has `role="textbox"` and `aria-multiline`; give it a name (Setup).
- Chrome is read inline with the document's text: `aria-hidden` on decorative parts, a name on
  every control, controls focusable and wrapped in `useStopEvent` so Wordgard leaves their keys.

## Migrating react-prosemirror node views

There are no node views: a node is drawn by decorations (its shape and wrappers), and a node view
component becomes one with `createShape` or `createWrapper`.

| react-prosemirror                                                              | react-wordgard                                                                   |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `<ProseMirror state dispatchTransaction>`                                      | `<WordgardEditor doc config>`, uncontrolled; changes via `wg.dispatch`           |
| `<ProseMirrorDoc />`                                                           | `<WordgardDoc />`                                                                |
| `nodeViews`                                                                    | `Decoration.Tag.shape(Type, createShape(component))` in `config`, atoms included |
| `markViews`                                                                    | `createMarkShape` with `Decoration.Mark.shape`                                   |
| `NodeViewComponentProps`                                                       | `ShapeComponentProps` (same `nodeProps`, `contentDOMRef`, `children`, `ref`)     |
| `node.attrs`                                                                   | `node.tag.param` for identity, `node.tag.mark(Type)` for data changed in place   |
| `view` in callbacks                                                            | `wg`                                                                             |
| `ProseMirror-selectednode`, `selectedCell`                                     | `wg-selected-node`, `wg-selected-cell`                                           |
| `useNodePos()` returning a number                                              | `useNodePos()` returning a function                                              |
| `useEditorEffect` for same-paint layout                                        | `useEditorLayoutEffect`                                                          |
| `useStopEvent`, `useIgnoreMutation`, `useSelectNode`, `useEditorEventListener` | the same names, the editor first in callbacks                                    |
| `useIsNodeSelected`, `useMergedDOMRefs`                                        | the same                                                                         |
| `innerDecorations`, `useIsComposingIn`, `useIsEditorStatic`                    | none                                                                             |

ProseMirror's model maps to Wordgard's in its migration guide:
https://wordgard.net/docs/prosemirror/

## When something fails

- "…must draw a DecorationRoot, or forward its ref to its root element": the component's root is
  neither a `DecorationRoot` nor given `ref` (on React 18, a hand-written root needs `forwardRef`).
- "…drew <x> where its shape says <y>": draw the element the shape says (the node type's, or
  `element`), or pass the drawn one to the shape's `of`.
- "React's DOM has extra nodes" or "…chrome is between its content's nodes": chrome sits in a
  content element where it can't (see the contract).
- "A React widget's component must forward its ref to its root element": a widget drawing its
  root by hand needs `forwardRef` (React 18) and `ref` on its root; or use `DecorationRoot`.
- "DecorationRoot is the root of a React shape, wrapper, mark or widget: use it in their
  component": a `DecorationRoot` outside those components (in a toolbar, say).
- "A React wrapper's component must draw its children": a wrapper drew nothing where it wraps.
- "A React shape drawing an atom has no content: drop its contentDOMRef": the node type draws an
  atom (a leaf, a plot without a hole), so its React shape has no content element.
- "A React shape can't wrap: use createWrapper", "A React wrapper isn't a shape: use createShape":
  a factory's value went to the other decoration.
- "…is called outside a React shape, wrapper, mark or widget": a decoration hook (`useNodePos`,
  `useStopEvent`, `useIgnoreMutation`, `useSelectNode`, `useIsNodeSelected`) used elsewhere.
  "Used outside a Wordgard editor": an editor hook outside `WordgardEditor`.
- "This React shape or wrapper isn't drawn" (or widget, or mark): `useNodePos()`'s function called
  during render or after unmount; call it in handlers and effects.
- "Leaf nodes shapes shouldn't have a content hole": a React shape's `.of(element)` given to a
  leaf; use `.of(element, { atom: true })`.
- "A React wrapper can't wrap a native widget: draw … with a React widget", "A React wrapper
  can't wrap text": a wrapper around a node a native widget draws, or around text.
- "This editor is already rendered by another WordgardDoc": one `WordgardDoc` per editor.
- "react-wordgard can't render part of …", "…can't render the shape of … yet": a shape or
  decoration react-wordgard doesn't draw yet; the message names the node type.
- "ReactWordgard can't update while React renders or commits": layout was read from a plain React
  effect; use `useEditorEffect` or `useEditorLayoutEffect`.
- "Cannot dispatch new updates during the editor flush phase": a dispatch from
  `useEditorLayoutEffect` or a render; dispatch from an event handler or `useEditorEffect`.
- Two copies of `wordgard` (`npm ls wordgard`) break `instanceof` checks in odd places.
