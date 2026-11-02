# react-wordgard

> **Under construction.** react-wordgard isn't ready for production yet, and its API may still
> change.

react-wordgard stays on 0.x for as long as Wordgard does: it follows Wordgard's API and reaches
into its internals, so it can't be more stable than Wordgard. Its 1.0 comes after Wordgard's.

A React view for [Wordgard](https://www.npmjs.com/package/wordgard): React draws Wordgard's
document, inside Wordgard's own update, and Wordgard keeps doing what it does (input, selection,
composition, decorations). The API is Wordgard's; react-wordgard adds what React needs to draw it.

This repository is derived from
[react-prosemirror](https://github.com/handlewithcarecollective/react-prosemirror),
by [Handle with Care Collective](https://github.com/handlewithcarecollective)
and originally The New York Times Company. Thanks to them for the design this
builds on.

## Install

```sh
npm install react-wordgard wordgard react react-dom
```

Peer dependencies: `wordgard` 0.6 (`~0.6.2`: react-wordgard reaches into Wordgard's internals, so
only its patches), `react` and `react-dom` 18 or 19. An app must have one copy of `wordgard`, the
one react-wordgard uses. With TypeScript, Wordgard's own typings need `skipLibCheck`.

With an AI coding agent: the package ships a skill for building editors with Wordgard and
react-wordgard, `skills/react-wordgard/SKILL.md` (in `node_modules/react-wordgard/`). Point your
agent to it, or copy the `react-wordgard` folder into your project's `.claude/skills/` for Claude
Code.

## Usage

```tsx
import { useState } from "react";
import { Decoration, Wordgard } from "wordgard/editor";
// `image()` adds images to the schema; `Image` is their node type, which decorations name.
import { basicSchema, image } from "wordgard/schema";
import { Image } from "wordgard/types";
import {
  DecorationRoot,
  WordgardDoc,
  WordgardEditor,
  createShape,
  useEditorStateSelector,
} from "react-wordgard";

// An image's shape, drawn by a React component with state of its own: hovering outlines it.
// DecorationRoot is its root: the node type's element, an <img>, with the node's attributes (its
// `src` and `alt`, the selected node's class) and the component's own props.
const ImageShape = createShape(function ImageShape() {
  const [hover, setHover] = useState(false);
  return (
    <DecorationRoot
      style={hover ? { outline: "2px solid" } : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    />
  );
});

function WordCount() {
  const words = useEditorStateSelector((state) => state.doc.textContent().split(/\s+/).length);
  return <output>{words} words</output>;
}

export function Editor() {
  return (
    <WordgardEditor
      doc='<p>Hello <strong>world</strong> <img src="/cat.png" alt="A cat"></p>'
      config={[
        basicSchema(),
        image(),
        Decoration.Tag.shape(Image, ImageShape),
        Wordgard.contentAttributes.of({ "aria-label": "Document" }),
      ]}
    >
      <WordCount />
      <WordgardDoc className="editor" />
    </WordgardEditor>
  );
}
```

A component can also draw its root itself: the element the node type says, with the `ref` and
the `props` it gets (Wordgard's attributes, as `DecorationRoot` takes them). React 19 passes `ref`
as a prop; on React 18, wrap the component in `forwardRef` to get it:

```tsx
const ImageShape = createShape<HTMLImageElement>(function ImageShape({
  nodeProps,
  children,
  ref,
  ...props
}) {
  return <img {...props} ref={ref} />;
});
```

- `<WordgardEditor>` creates the editor from a `Wordgard.Spec` and provides it to what it holds.
  The spec is read once, when it mounts: changing `doc` or `config` afterwards does nothing. The
  editor owns its state: change it with `dispatch`, and its configuration with Wordgard's
  compartments or `GardState.appendConfig`. `<WordgardDoc>` puts the editor in the page and
  renders the document through a portal, in your React tree: your contexts reach React
  decorations. One `<WordgardDoc>` per editor; a second one throws.
- `createShape`, `createWrapper`, `createMarkShape` and `createWidgetType` make React components
  Wordgard decorations: below. Call them at module level, with components defined there.
  `createShape`, `createWrapper` and `createMarkShape` give the same value for the same component
  (and `element`), so a config built again is the same; a component defined inside a render is a
  new one each time, and remounts everything it draws. The components don't need
  memoizing: React draws a node again only when it changed (its content, its shape, its
  attributes, its widget's value), or from the component's own state, contexts and hooks.
- Hooks, from inside `<WordgardEditor>`:
  - `useWordgard()`: the editor.
  - `useEditorState()`, `useEditorStateSelector(selector, isEqual?)`: the state as of the
    editor's last flush, rendered in the same React commit as the document. The selector's result
    re-renders when it changes, by `Object.is` or by `isEqual`.
  - `useEditorEffect(effect, deps)`: an effect run once the editor's DOM is up to date, where it
    may read layout (`coordsAtPos`) and dispatch.
  - `useEditorEventCallback(callback)`: a stable callback getting the editor.
  - `useEditorLayoutEffect({ read, write })`: reads in every update's read phase, writes in its write
    phase, on the same paint as the document, for what must move with the text (markers in the
    margin, pagination). It can't dispatch: Wordgard throws during its update. A `read` returning
    `undefined` skips its write; when none asks for one, no write is scheduled, which spares
    Wordgard measuring again. Reads run in the order the effects were registered: an engine whose
    parts must run in another order registers one effect and drives them.
  - `useEditorEventListener(type, (wg, event) => handled)`: the editor's DOM events of `type`
    before Wordgard's handlers and keymaps; returning true handles the event. Key events during
    a composition don't come; handling `input`, `beforeinput` or composition events skips
    Wordgard's own handling of them.
- Hooks, from inside a React shape, wrapper, mark or widget:
  - `useNodePos()`: a function returning the position of what it draws.
  - `useStopEvent((wg, event) => stop)`: Wordgard leaves alone the events it stops, in the
    decoration's chrome, on its own elements (its root and the elements around its content
    element, unless the root is the content element) or in a React widget, and their default goes
    ahead. Never in its content.
  - `useIgnoreMutation((wg, record) => ignore)`: Wordgard doesn't read the DOM mutations it
    claims, typing aside (Wordgard takes it from `beforeinput`).
  - `useIsNodeSelected()`, `useSelectNode(select, deselect?)`: the node selection.
  - `useMergedDOMRefs(...refs)`: one ref setting several, as for a root that's also the content
    element.
- In React's StrictMode (development only), `<WordgardEditor>` creates its editor twice and
  drops one, which is never put in the page.
- Don't read the editor's layout from a plain React effect: it runs inside Wordgard's update,
  before the editor's view of the new DOM exists. Use `useEditorEffect` or `useEditorLayoutEffect`.

### React decorations

A node's shape, a wrapper, a mark's shape and a widget can each be a React component. Shapes,
wrappers and marks render what they hold as `children`; each can change the DOM around it (its
"chrome") on its own: from its state, a context or a store. Each factory returns Wordgard's own
value (a shape, a wrapper, a mark's shape, a widget type), registered as drawn by the component,
which you pass to Wordgard's decorations:

```tsx
import { Decoration } from "wordgard/editor";
import { Blockquote, Link } from "wordgard/types";
import { DecorationRoot, createMarkShape, createShape } from "react-wordgard";

// A blockquote drawn as a callout: a decorative icon, then the content.
const CalloutShape = createShape(function Callout({ nodeProps: { contentDOMRef }, children }) {
  return (
    <DecorationRoot>
      <span aria-hidden="true">💡</span>
      <div className="body" ref={contentDOMRef}>
        {children}
      </div>
    </DecorationRoot>
  );
});

// A link, its target the mark's value.
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

const config = [
  Decoration.Tag.shape(Blockquote, CalloutShape),
  Decoration.Mark.shape(Link, LinkMark),
];
```

- `createShape(component)` returns a node's shape for `Decoration.Tag.shape`: the type's nodes are
  drawn by the component, its root the node type's own outer element, its tag for each node (a
  heading's level gives `h1` to `h6`) and its attributes. (It's a function of the node's tag, a
  form `Decoration.Tag.shape` takes.) The component gets `nodeProps` (`node`, `getPos`,
  `contentDOMRef`) and `children` (the content). The content goes in the `contentDOMRef` element,
  else in the root. Define the component inline, as a named function, and its props are typed for
  you.
- Only the outer element comes from the node type: the elements inside a structure shape (a
  figure's `img`, a table's `tbody`) are the component's to draw, from `nodeProps.node`. Wordgard
  puts attributes aimed at them (`ImageAlt`'s and `ImageSize`'s on a figure) on the root, and a
  `target` that matches nothing picks the root.
- Where the node type draws an atom (a leaf: an image, a mention; a plot whose shape has no
  hole), so does its React shape: `children` is empty, everything the component draws is chrome,
  and a `contentDOMRef` throws.
- `shape.of(element, { atom? })` is the shape with `element` for its root, for
  `Decoration.Point.shape` (which applies to whatever node follows, so no type says the element)
  or a root other than the type's: `Decoration.Tag.shape(Blockquote, CalloutShape.of("aside"))`.
  With `atom: true`, it has no hole: a leaf needs it (Wordgard refuses a hole in a leaf's shape),
  and it draws a plot as an atom.
- `createWrapper(component, { element? })`, for `Decoration.Tag.wrapper` and
  `Decoration.Point.wrapper`: the same props without `contentDOMRef`; `children` is what it
  wraps (the node's shape, or the element its `target` picks). `element` is its root, `div` by
  default: a wrapper is an element the node type doesn't have.
- `createMarkShape(component, { element? })`, for `Decoration.Mark.shape` or a mark type's own
  `shape`: `markProps` (`mark`, the document's, `getPos`, `contentDOMRef`) and `children`. One
  component draws each run of an equal mark. `element` is its root, `span` by default: Wordgard's
  mark shape is a fixed spec, also a mark type's own `shape` before the type exists, so the
  element can't come from the mark type. A React mark replacing an attribute-shaped mark makes it
  element-shaped.
- The root is the element the decoration says, and stays that element. Wordgard applies
  decorations to a shape before anything is drawn (`target` selectors match its tag, attributes
  merge onto its elements), so the tag has to be known up front.
- `<DecorationRoot>` draws it, in a shape's, wrapper's or mark's component: that tag, with
  Wordgard's attributes (the node type's own, the selection classes `wg-selected-node` and
  `wg-selected-cell`, tag, point and mark attributes, `contenteditable` on an atom) and the root's
  ref. The component's own props win, except `className`, joined with Wordgard's, and `style`,
  merged with it (the component's keys winning). Its `ref` gets the root too. Without a
  `contentDOMRef`, the content goes in it. One per component, at its root; not in a widget.
- Or the component draws the root itself, from the `ref` and `props` it gets, which carry the
  same attributes: `<blockquote {...props} ref={ref}>`. Use one or the other: `props` spread onto
  `DecorationRoot` would apply twice. Setting its own `className` or `style`, it merges them with
  the attributes' (joins the classes, spreads the style), or one replaces the other. On React 18,
  such a component needs `forwardRef` to get its `ref`. In development, a root with another tag
  logs an error.
- The chrome is made uneditable unless it sets `contentEditable` itself.
- `createWidgetType(spec)`, for a widget: at a position (`Decoration.Point.widget`), before or
  after a node (`Decoration.Tag.widget`), inside an `Elt` shape. It takes `Widget.define`'s spec,
  `component` in place of `render` (`eq`, `editable`, `inFlow`, `propagateEvent`, `connect`,
  `disconnect` keep their meaning), and returns a real `Widget.Type`: its widgets are
  `type.of(value)`, and the component gets the `value` and a `ref` for its root, which it draws
  itself (`forwardRef` on React 18). React widgets are uneditable by default. A widget can also
  draw a node, as Wordgard allows, `Decoration.Tag.shape(nodeType, (tag) => type.of(tag.param))`,
  and the component gets the node's attributes as props; a React shape is the usual way.

### A shape, a wrapper, or both

- A node type's shape decides where attributes go: a mark's or an attribute decoration's `target`
  or `preferTarget` picks an element in it. `ImageAlt` and `ImageSize` go on a figure's `img`
  because the figure's shape has one.
- React chrome around a node, or around an element in its shape, is a React wrapper:
  `Decoration.Tag.wrapper(Figure, createWrapper(Frame), { target: "img" })` puts `Frame` around
  the figure's `img`, which keeps its `src`, `alt` and width.
- A shape and wrappers register on the same node type and apply to all its nodes.
- For example: an image is the type's `img`, with a React frame around it for a resize handle. A
  table is a React shape drawing `table > tbody > {children}`, with a wrapper for what goes outside
  the table (a scroll container, column handles). A node taller than a page is clipped by a wrapper
  whose component reads a store.

That's a step more than a react-prosemirror node view, which draws all of its node's DOM. Wordgard
applies decorations to the node type's shape before React draws, so an element decorations aim at
must be in that shape. A wrapper adds React around it without taking it over.

### Node data that changes

A component keeps its state while its node changes in place or moves within its parent, and
remounts, with everything inside it, when its node is replaced. So how an editing action changes a
node matters:

- Data an action changes on a node (an image's size, a block's alignment, a callout's kind, a
  table's column widths) is a mark on its tag: a type made with `Mark.Type.define(name, { target })`,
  read with `node.tag.mark(Type)`, changed with `{ from: pos, add: Type.of(value) }` and
  `{ from: pos, remove: Type.of(value) }`. That's Wordgard's model: a mark change merges in
  collaboration and inverts in history, and the component re-renders. Wordgard's `ImageSize` is
  one; the demo's callout keeps its kind and title so (`demo/schema.ts`).
- What identifies the node (an image's `src`, a heading's level) is its parameter. Change it by
  retagging, replacing the node's opening token by one of the same type, as Wordgard's commands
  do: `{ from: pos, to: pos + 1, insert: [Heading.of(2)] }`. The component re-renders, and its
  content keeps its components.
- Replacing the node whole (`{ from, to, insert: [node] }`) or changing its type remounts it.
- A move keeps the component, and the components inside, when the node stays in its parent: in one
  transaction, it's deleted and the same node object is inserted elsewhere in that parent. A copy
  (a new node, or the same one inserted while the original stays) mounts anew, and so does a node
  moved to another parent. React point widgets inside a moved node are drawn anew, as Wordgard
  redraws them. React moves the node's DOM, and a browser reloads an `<iframe>` on any
  DOM move. Wordgard's drag-and-drop rebuilds what it drops from HTML, so its moves remount.

ProseMirror's `setNodeAttribute` and `setNodeMarkup` port to one of the first two.

### Accessibility

- Wordgard gives the editable element `role="textbox"` and `aria-multiline`. Name it with
  `Wordgard.contentAttributes.of({ "aria-label": "…" })`: in Wordgard 0.6.2, `Wordgard.label`
  puts the label on the editor's outer element, which leaves the textbox without a name.
- A React decoration's chrome is read inline, with the document's text. Hide what's decorative
  (`aria-hidden` on icons and counters), and give every control a name (its text or
  `aria-label`).
- Chrome is uneditable: a control in it needs to be focusable to be reached by keyboard, and
  `useStopEvent` for its events, so that Wordgard leaves its keys alone.
- A React shape or widget drawing a node gets the node's attributes as props, an image's `alt`
  among them: spread them onto the root.
- The tests run axe-core over editors with React shapes, marks and widgets
  (`src/__tests__/accessibility.browser.test.tsx`): nothing breaks a rule plain Wordgard keeps.

### Limits

- A React decoration must keep its root element. Moving `{children}` under another element
  remounts the content: the browser loses a selection or an IME composition in it.
- In a textblock or a mark, the content element holds only the content: chrome there would be text
  that can't be told from the content's. Chrome next to a textblock's text (line numbers, a
  marker) is a tag widget at `"start"` or `"end"`, a React widget that may read the shape's
  context: `Decoration.Tag.widget(Paragraph, "start", LineNumber.of(null))`. Wordgard places the
  caret around it. In a node holding blocks, chrome may sit before or after
  the content in the same element, not between its nodes.
- A React wrapper can't wrap a node a native widget draws (draw it with a React widget), nor text.
- `useStopEvent` is asked for events in chrome, on a decoration's own elements and in React
  widgets, not in content: react-prosemirror asks for everything in a node view, its content
  included.
- An attribute code sets by hand (a resize observer's, a layout engine's) on a React decoration's
  root or structure stays through Wordgard's updates and the component's renders, until React sets
  that attribute itself: a `classList.add` goes when React sets `className` again (the node gets
  selected, a mark adds a class). On an element Wordgard draws, Wordgard's next update undoes it.
  Draw such state from decorations or the component's state instead; in a decoration's content,
  `useIgnoreMutation` keeps Wordgard from undoing a change it claims, until Wordgard redraws there.
- `useEditorEventListener` takes these event types: keyboard (`keydown`, `keyup`, `keypress`),
  input (`beforeinput`, `input`, composition events), mouse (`mousedown`, `mouseup`, `mouseover`,
  `mouseout`, `click`, `dblclick`, `contextmenu`), `focus`, `blur`, clipboard (`copy`, `cut`,
  `paste`) and drag-and-drop events. Wordgard adds a handler per type when the editor is created;
  scroll-blocking and the most frequent events (touch, wheel, `mousemove`, pointer events) are left
  out.
- A node drawn by a React widget has no element around it for its attributes, unlike plain
  Wordgard's: its component gets them as props, so a selection doesn't remount it.
- Typing with marks before there's text draws a mark from its own type, not a
  `Decoration.Mark.shape` override, as Wordgard does.
- Wordgard 0.6.2's own typings need `skipLibCheck`.

## Migrating from react-prosemirror

react-wordgard isn't a compatibility layer: it follows Wordgard's API, and most of a migration is
moving from ProseMirror's concepts to Wordgard's (see Wordgard's
[ProseMirror migration guide](https://wordgard.net/docs/prosemirror/)). What changes on the React
side:

| react-prosemirror                                 | react-wordgard                                                                                                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<ProseMirror state={…} dispatchTransaction={…}>` | `<WordgardEditor doc={…} config={…}>`, uncontrolled: the editor owns its state, changes go through `wg.dispatch`                                      |
| `<ProseMirrorDoc />`                              | `<WordgardDoc />`                                                                                                                                     |
| `plugins` prop                                    | Wordgard extensions in `config`; to change them later, compartments or `GardState.appendConfig`                                                       |
| `nodeViews` prop and node view components         | Tag decorations: `Decoration.Tag.shape(NodeType, createShape(component))` for any node, atoms included; `createWrapper` with `Decoration.Tag.wrapper` |
| `markViews` prop and mark view components         | `createMarkShape` with `Decoration.Mark.shape`                                                                                                        |
| `widget()` decorations with a component           | `Decoration.Point.widget(MyReactWidget.of(value))`                                                                                                    |
| `getPos` prop, `useNodePos`                       | `nodeProps.getPos`, `useNodePos()` (a function, not the position)                                                                                     |
| `useStopEvent`                                    | the same name, for events in a React decoration's chrome, on its own elements or in a React widget, not in its content                                |
| `useIgnoreMutation`                               | the same name; chrome's and React widgets' mutations never reach Wordgard anyway                                                                      |
| `useEditorState`, `useEditorStateSelector`        | the same names, with the state of the last flush                                                                                                      |
| `useEditorEffect`                                 | the same name: runs after the editor's update; what it sets shows a frame later (below)                                                               |
| `useIsNodeSelected`, `useSelectNode`              | the same names                                                                                                                                        |
| `useMergedDOMRefs`                                | the same name                                                                                                                                         |
| `useEditorEventCallback`                          | the same name, getting the editor                                                                                                                     |
| `useEditorEventListener`                          | the same name, before Wordgard's handlers and keymaps, for a fixed set of event types                                                                 |
| `useLayoutGroupEffect`                            | `useEditorEffect`; `useEditorLayoutEffect` to measure, then write on the same paint                                                                   |
| `reactKeys()` plugin                              | not needed: keys come from the changes Wordgard gives the view                                                                                        |

Not offered: `useIsComposingIn`, `useIsEditorStatic`.

### Migrating a node view

A react-prosemirror node view keeps its body: the props keep their names (`nodeProps`,
`contentDOMRef`, `children`, `ref`, the attributes). What changes:

- The props type: `ShapeComponentProps` (any node, atoms included), `WrapperComponentProps`,
  `MarkComponentProps`.
- The root's tag isn't the component's choice: it's the node type's own element, what `toDOM`'s
  outer element was. ProseMirror builds a node view's description from whatever DOM it gets;
  Wordgard applies decorations to the shape before anything is drawn, so it needs the tag first.
- `node.attrs` becomes the node's parameter (`node.tag.param` for a node with content, `node.param`
  for a leaf), and `view` becomes `wg`, Wordgard's editor.
- Registration: `Decoration.Tag.shape(NodeType, createShape(component))` in the editor's `config`
  instead of `nodeViews`.
- Class names: `ProseMirror-selectednode` is `wg-selected-node`, a selected cell's class
  `wg-selected-cell`.
- `useNodePos()` returns a function giving the position, not the position.
- `innerDecorations` has no equivalent.

### Effects and timing

In react-prosemirror React drives: `useEditorEffect` is a React layout effect that runs after the
view's update, inside React's commit, so it can read layout, dispatch, and what it sets shows on the
same paint. In react-wordgard Wordgard drives: React commits inside Wordgard's update, and those
properties split between two hooks.

|                                           | react-prosemirror `useEditorEffect` | `useEditorEffect`                  | `useEditorLayoutEffect`                              |
| ----------------------------------------- | ----------------------------------- | ---------------------------------- | ---------------------------------------------------- |
| Reads layout after the update             | yes                                 | yes                                | yes, in Wordgard's read phase                        |
| May dispatch                              | yes                                 | yes                                | no                                                   |
| What it sets shows on the same paint      | yes                                 | no, a frame later                  | yes                                                  |
| Runs on every update without re-rendering | no                                  | no                                 | yes                                                  |
| For                                       | everything                          | menus, focus, follow-up dispatches | what moves with the text: margin markers, pagination |

## Licence

MIT, © 2026 Edoardo Caratti, see [LICENSE.txt](LICENSE.txt).

Includes code from react-prosemirror (© Handle with Care Collective and The New
York Times Company) and Wordgard (© Marijn Haverbeke); their notices are in [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt).
