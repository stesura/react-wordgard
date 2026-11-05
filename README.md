# react-wordgard

> **Under construction.** react-wordgard isn't ready for production yet, and its API may still
> change.

react-wordgard stays on 0.x for as long as Wordgard does: it follows Wordgard's API and reaches
into its internals, so it can't be more stable than Wordgard. Its 1.0 comes after Wordgard's.

A React view for [Wordgard](https://www.wordgard.net): React draws the Wordgard document in a
single tree, your app's, and any decoration that takes a shape, a wrapper or a widget can be a
React component. Wordgard keeps doing the rest (input, selection, composition), and the API stays
Wordgard's.

A React decoration renders its content as `{children}`, reads your app's contexts and stores, and
can re-render on its own without breaking the editor.

## Contents

- [Inspired by react-prosemirror](#inspired-by-react-prosemirror)
- [Install](#install)
- [Usage](#usage)
  - [Accessing the state outside the editor](#accessing-the-state-outside-the-editor)
  - [React decorations](#react-decorations)
  - [Should I use a shape, a wrapper or both?](#should-i-use-a-shape-a-wrapper-or-both)
  - [Accessibility](#accessibility)
  - [Limits](#limits)
- [API](#api)
  - [Components](#components)
  - [Decoration factories](#decoration-factories)
  - [Editor hooks](#editor-hooks)
  - [Decoration hooks](#decoration-hooks)
  - [Props types](#props-types)
- [Migrating from react-prosemirror](#migrating-from-react-prosemirror)
  - [Migrating a node view](#migrating-a-node-view)
  - [Effects and timing](#effects-and-timing)
- [AI coding agents](#ai-coding-agents)
- [Licence](#licence)

## Inspired by react-prosemirror

react-wordgard is derived from
[react-prosemirror](https://github.com/handlewithcarecollective/react-prosemirror), by
[Handle with Care Collective](https://github.com/handlewithcarecollective) and originally The New
York Times Company. We're hugely grateful for their work: the design here builds on it.

Marijn Haverbeke's Wordgard makes the bridge much easier to build. Most of react-prosemirror's
difficulties come from React rendering in two phases while ProseMirror's view updates in one: during
a render, components can see a newer state than the view
([react-prosemirror's README](https://github.com/handlewithcarecollective/react-prosemirror#the-problem)
explains the problem). Wordgard doesn't update the DOM when you dispatch, but in its flush, on the
next frame (or sooner, when something needs the layout). react-wordgard renders the document inside
that flush, in one synchronous render, and its hooks read the state of the last flush: components
never see a state the page doesn't show. Wordgard also tells its view which parts of the document
changed and reads its view tree as plain data, so react-wordgard can build that tree from the DOM
React drew.

What Wordgard doesn't give you is React in its decorations: a shape, wrapper or widget is DOM, and
a React component there would mean portals into DOM that Wordgard owns and rewrites. That's what
react-wordgard is for.

The API stays as close to react-prosemirror's as Wordgard allows.

## Install

```sh
npm install @stesura/react-wordgard wordgard react react-dom
```

- `wordgard` 0.6.2 or a later 0.6 patch. A new minor (0.7) needs a react-wordgard release made
  for it, as react-wordgard uses Wordgard's internals.
- `react` and `react-dom` 18 or 19.
- Only one copy of `wordgard` in your app: `npm ls wordgard` should list one version. With two, the
  editor won't work.
- With TypeScript, `"skipLibCheck": true` in your `tsconfig.json`: Wordgard's own typings don't
  type-check ([#120](https://code.haverbeke.berlin/wordgard/wordgard/issues/120)).

## Usage

```tsx
import { useState } from "react";
import { Decoration, Wordgard } from "wordgard/editor";
import { basicSchema, image } from "wordgard/schema";
import { Image } from "wordgard/types";
import {
  DecorationRoot,
  WordgardDoc,
  WordgardEditor,
  createShape,
  useEditorStateSelector,
} from "@stesura/react-wordgard";

const ImageShape = createShape(function ImageShape() {
  const [hover, setHover] = useState(false);
  return (
    // DecorationRoot is its root: the node type's element, an <img>, with the node's attributes (its
    // `src` and `alt`, the selected node's class) and the component's own props.
    <DecorationRoot
      style={hover ? { outline: "2px solid" } : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    />
  );
});

const WordCount = () => {
  const words = useEditorStateSelector((state) => state.doc.textContent().split(/\s+/).length);
  return <output>{words} words</output>;
};

export const Editor = () => {
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
};
```

`<WordgardEditor>` creates the editor and `<WordgardDoc>` puts it in the page; React decorations
are below, and every component and hook is under [API](#api).

### Accessing the state outside the editor

Wordgard's editor owns its state: there's no `setState` and no way to intercept its dispatches, so
the state can't be lifted into React and passed back in, as react-prosemirror's
`<ProseMirror state>` allows. To reach it from outside the document, to save it as JSON for
example, you have two options:

1. **Lift `<WordgardEditor>`.** It draws no DOM: the editor goes where `<WordgardDoc />` is. Wrap
   everything that needs the editor in it:

```tsx
import { basicSchema } from "wordgard/schema";
import { WordgardDoc, WordgardEditor, useEditorEventCallback } from "@stesura/react-wordgard";

const SaveButton = () => {
  const save = useEditorEventCallback((wg) => {
    localStorage.setItem("doc", JSON.stringify(wg.state.doc.toJSON()));
  });
  return <button onClick={save}>Save</button>;
};

export const Page = () => (
  <WordgardEditor doc="<p>Hello</p>" config={[basicSchema()]}>
    <header>
      <SaveButton />
    </header>
    <main>
      <WordgardDoc />
    </main>
  </WordgardEditor>
);
```

2. **Share the editor through a store.** Where `<WordgardEditor>` can't wrap the button (another
   part of the app, a portal), a component under it hands the editor to a store from
   `useEditorEffect`. This example uses [Jotai](https://jotai.org), but any store works.

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

const Editor = () => (
  <WordgardEditor doc="<p>Hello</p>" config={[basicSchema()]}>
    <ShareEditor />
    <WordgardDoc />
  </WordgardEditor>
);

// The button is outside the editor's tree.
export const App = () => (
  <>
    <header>
      <SaveButton />
    </header>
    <main>
      <Editor />
    </main>
  </>
);
```

### React decorations

Node decorations (shapes, wrappers, widgets) and mark decorations can be React components. Shapes,
wrappers and marks render their content as `children`, and can change the DOM around it on their
own, from their state, a context or a store. Call the factories at module level: a component
defined inside a render is new each time, and remounts everything it draws. The components don't
need memoizing.

```tsx
import { Decoration } from "wordgard/editor";
import { Blockquote, Link } from "wordgard/types";
import { DecorationRoot, createMarkShape, createShape } from "@stesura/react-wordgard";

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

- `createShape(component)`, for `Decoration.Tag.shape`: the component gets `nodeProps` (`node`,
  `getPos`, `contentDOMRef`) and the content as `children`, which goes in the `contentDOMRef`
  element, else in the root. Define it inline, as a named function, and its props are typed for you.
- The root is the node type's outer element (`h1` to `h6` for a heading, `img` for an image).
  `<DecorationRoot>` draws it with Wordgard's attributes (the node's, the selection classes, the
  decorations') and its ref; your props win, `className` and `style` are merged. Or draw it by
  hand: below. Another tag logs an error.
- What's inside the root (a figure's `img`, a table's `tbody`) is the component's to draw, and
  attributes aimed there land on the root: see
  [Should I use a shape, a wrapper or both?](#should-i-use-a-shape-a-wrapper-or-both).
- An atom (an image, a mention) gets empty `children`, and a `contentDOMRef` throws.
- `shape.of(element, { atom? })` is the shape with another root, also for
  `Decoration.Point.shape`: `CalloutShape.of("aside")`. A leaf needs `atom: true`.
- `createWrapper(component, { element? })`, for `Decoration.Tag.wrapper` and
  `Decoration.Point.wrapper`: the same props without `contentDOMRef`, and what it wraps as
  `children`. Its root is a `div` by default.
- `createMarkShape(component, { element? })`, for `Decoration.Mark.shape`: `markProps` (`mark`,
  `getPos`, `contentDOMRef`) and `children`, one component per run of the mark. Its root is a
  `span` by default.
- The chrome is uneditable unless it sets `contentEditable`.

#### A root drawn by hand

`DecorationRoot` applies all of Wordgard's attributes. To decide what reaches the root (drop one,
change one, join Wordgard's classes your way) or to type the root as its element, the component
draws the root itself. It gets Wordgard's attributes as props and a `ref` for the root.

On React 19, `ref` is a prop:

```tsx
import { createShape } from "@stesura/react-wordgard";

// An image whose root drops the `title` a decoration gives it and adds a class of its own.
const ImageShape = createShape<HTMLImageElement>(function ImageShape({
  nodeProps,
  children,
  className,
  title,
  ref,
  ...props
}) {
  return <img {...props} ref={ref} className={["picture", className].join(" ").trim()} />;
});
```

On React 18, the component needs `forwardRef` to get it:

```tsx
import { forwardRef } from "react";
import { type ShapeComponentProps, createShape } from "@stesura/react-wordgard";

const ImageShape = createShape(
  forwardRef<HTMLImageElement, ShapeComponentProps<HTMLImageElement>>(function ImageShape(
    { nodeProps, children, className, title, ...props },
    ref
  ) {
    return <img {...props} ref={ref} className={["picture", className].join(" ").trim()} />;
  })
);
```

- Draw the element the decoration says (the node type's for a shape, `element` for a wrapper or
  mark), spread the props, and put `ref` on it.
- `className` holds Wordgard's classes (the selection's among them): join yours with them, or
  they're lost.
- `style` holds Wordgard's style as an object: spread yours over it,
  `style={{ ...style, color: "red" }}`, or it replaces Wordgard's.
- Use one or the other: spreading these props onto `<DecorationRoot>` applies Wordgard's
  attributes twice (its classes appear twice).
- `createWrapper` and `createMarkShape` components work the same way (`WrapperComponentProps`,
  `MarkComponentProps`).

#### React widgets

```tsx
import { Decoration } from "wordgard/editor";
import { Paragraph } from "wordgard/types";
import {
  DecorationRoot,
  type WidgetComponentProps,
  createWidgetType,
} from "@stesura/react-wordgard";

// A pilcrow at the start of every paragraph.
const Pilcrow = createWidgetType({
  component: function Pilcrow({ value }: WidgetComponentProps<string>) {
    return <DecorationRoot aria-hidden="true">{value}</DecorationRoot>;
  },
});

const config = [Decoration.Tag.widget(Paragraph, "start", Pilcrow.of("¶"))];
```

- `createWidgetType(spec)`, for a widget: at a position (`Decoration.Point.widget`), beside a node
  (`Decoration.Tag.widget`), inside an `Elt` shape. It takes `Widget.define`'s spec, `component`
  in place of `render` (`eq`, `editable`, `inFlow`, `propagateEvent`, `connect`, `disconnect` keep
  their meaning), and returns a real `Widget.Type`: its widgets are `type.of(value)`.
- The component gets the `value`. Its root is a `DecorationRoot`, a `span` unless the spec gives
  another `element` (`createWidgetType({ component, element: "div" })`): Wordgard doesn't look at
  a widget's element, so it's the widget's choice. Or the component draws its root by hand, with
  the `ref` it gets (`forwardRef` on React 18), as a shape's can.
- Widgets are uneditable unless their spec sets `editable`, as in Wordgard.
- A widget can also draw a node, as Wordgard allows:
  `Decoration.Tag.shape(nodeType, (tag) => type.of(tag.param))`. `DecorationRoot` puts the node's
  attributes on its root (a root drawn by hand gets them as props). A React shape is the usual
  way.

#### Hooks inside React decorations

A React shape's, wrapper's, mark's or widget's component can also use `useNodePos`,
`useStopEvent`, `useIgnoreMutation`, `useIsNodeSelected`, `useSelectNode` and
`useMergedDOMRefs`: see [Decoration hooks](#decoration-hooks).

### Should I use a shape, a wrapper or both?

A shape draws the node; a wrapper adds React around it. Wordgard places attributes (a mark's or a
decoration's `target`) on the elements of the node type's shape before React draws, so a React
shape that draws more than its root gets the attributes aimed inside it on its root: a figure's
`alt` and width end up on the `<figure>`, not its `img`. Always match the shape's root to the node
type's element: `<DecorationRoot>` does it automatically, or draw the root by hand (see
[A root drawn by hand](#a-root-drawn-by-hand)). So `<DecorationRoot>` belongs at the root of a
shape, and chrome around it goes in an additional wrapper decoration.

For example, an image with a resize handle: the shape draws the `img`, which keeps its `src`, `alt`
and width, and the wrapper draws the handle.

```tsx
import { Decoration } from "wordgard/editor";
import { Image } from "wordgard/types";
import { DecorationRoot, createShape, createWrapper, useStopEvent } from "@stesura/react-wordgard";

const ImageShape = createShape(function ImageShape() {
  return <DecorationRoot className="image" />;
});

const Resizer = createWrapper(
  function Resizer({ children }) {
    // The handle's pointer events are its own, not Wordgard's.
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

const config = [Decoration.Tag.shape(Image, ImageShape), Decoration.Tag.wrapper(Image, Resizer)];
```

### Accessibility

React decorations are your components: make them accessible as you would any other. What
react-wordgard adds:

- A control in a decoration's chrome needs `useStopEvent`, or Wordgard handles its keys.
- `DecorationRoot` puts the node's attributes on its root, an image's `alt` among them; a root
  drawn by hand gets them as props, so spread them onto it.
- The tests run axe-core over editors with React shapes, marks and widgets: react-wordgard breaks
  no rule plain Wordgard keeps.

### Limits

- Keep `{children}` where it is: moving it under another element remounts the content, and the
  browser loses a selection or an IME composition in it.
- A React wrapper can't wrap text, or a node a native widget draws.
- `useEditorEventListener` takes keyboard (`keydown`, `keyup`, `keypress`), input (`beforeinput`,
  `input`, composition events), mouse (`mousedown`, `mouseup`, `mouseover`, `mouseout`, `click`,
  `dblclick`, `contextmenu`), `focus`, `blur`, clipboard (`copy`, `cut`, `paste`) and
  drag-and-drop events. Not touch, wheel, pointer events or `mousemove`.

## API

Everything is exported from `@stesura/react-wordgard`. Editor hooks work under `<WordgardEditor>`,
decoration hooks in a React decoration's component; elsewhere, they throw.

### Components

#### `WordgardEditor`

```ts
type WordgardEditor = (
  props: Omit<Wordgard.Spec, "parent"> & { children?: ReactNode }
) => JSX.Element;
```

Creates a Wordgard editor from the spec (`doc`, `config`, `selection`, `state`, `scrollTo`) and
provides it to its children. It draws no DOM of its own. The spec is read once, on mount: from then
on the editor owns its state (see
[Accessing the state outside the editor](#accessing-the-state-outside-the-editor)). In React's
StrictMode (development only), it creates its editor twice and drops one, which is never put in the
page.

#### `WordgardDoc`

```ts
type WordgardDoc = (props: Omit<HTMLAttributes<HTMLDivElement>, "children">) => JSX.Element;
```

Puts the editor in the page, inside a `div` taking the props, and renders the document through a
portal, in your React tree. It goes under its `<WordgardEditor>`, inside any other components, with
other children before or after it. One per editor: a second throws.

#### `DecorationRoot`

```ts
type DecorationRoot = (
  props: AllHTMLAttributes<HTMLElement> & { children?: ReactNode; ref?: Ref<Element> }
) => JSX.Element;
```

The root element of a React shape, wrapper, mark or widget: the tag the decoration says, with
Wordgard's attributes merged with the props. See [React decorations](#react-decorations).

### Decoration factories

Call them at module level. Each returns Wordgard's own value, which you pass to its decorations;
the same component gives the same value. Details and examples:
[React decorations](#react-decorations).

#### `createShape`

```ts
type createShape = <E extends Element = HTMLElement>(
  component: ComponentType<ShapeComponentProps<E>>
) => ReactShape;

type ReactShape = ((tag: Node.Tag) => Elt) & {
  of: (element: string, options?: { atom?: boolean }) => Elt;
};
```

A node's shape, for `Decoration.Tag.shape(NodeType, shape)`. `shape.of(element)` is the shape with
another root element, also for `Decoration.Point.shape`.

#### `createWrapper`

```ts
type createWrapper = <E extends Element = HTMLElement>(
  component: ComponentType<WrapperComponentProps<E>>,
  options?: { element?: string } // "div" by default
) => Elt;
```

A wrapper, for `Decoration.Tag.wrapper` and `Decoration.Point.wrapper`.

#### `createMarkShape`

```ts
type createMarkShape = <E extends Element = HTMLElement>(
  component: ComponentType<MarkComponentProps<E>>,
  options?: { element?: string } // "span" by default
) => { element: string; attributes: Record<string, string> };
```

A mark's shape, for `Decoration.Mark.shape(MarkType, shape)` or a mark type's own `shape`.

#### `createWidgetType`

```ts
type createWidgetType = <Param, E extends Element = HTMLElement>(
  spec: Omit<Widget.Spec<Param>, "render"> & {
    component: ComponentType<WidgetComponentProps<Param, E>>;
    element?: string; // "span" by default
  }
) => Widget.Type<Param>;
```

A widget type whose widgets, `type.of(value)`, the component draws.

### Editor hooks

#### `useWordgard`

```ts
type useWordgard = () => Wordgard;
```

The editor.

#### `useEditorState`

```ts
type useEditorState = () => GardState;
```

The state as of the editor's last flush, rendered in the same React commit as the document. The
component re-renders on every flush: for a part of the state, use `useEditorStateSelector`; in a
handler, `wg.state` is the latest.

#### `useEditorStateSelector`

```ts
type useEditorStateSelector = <Result>(
  selector: (state: GardState) => Result,
  isEqual?: (a: Result, b: Result) => boolean
) => Result;
```

A part of the last flush's state, like Redux's `useSelector`: the component re-renders only when
the result changes, by `Object.is` or by `isEqual`. A selector building a new object or array each
time re-renders on every flush unless you pass `isEqual`.

```tsx
export const SelectionInfo = () => {
  const empty = useEditorStateSelector((state) => state.selection.empty);
  return <output>{empty ? "Cursor" : "Selection"}</output>;
};
```

#### `useEditorEffect`

```ts
type useEditorEffect = (
  effect: (wg: Wordgard) => void | (() => void),
  dependencies?: DependencyList
) => void;
```

Runs `effect` once the editor's DOM is up to date: after the flush under way or pending, else in a
microtask, never inside React's commit. It may read layout and dispatch; what it sets shows a frame
later. For focus, follow-up dispatches and menus. The dependencies work as React's. Don't read the
editor's layout from a plain React effect: it can run inside Wordgard's update, before the editor's
view of the new DOM exists.

```tsx
export const FocusOnMount = () => {
  useEditorEffect((wg) => wg.focus(), []);
  return null;
};
```

#### `useEditorLayoutEffect`

```ts
type useEditorLayoutEffect = <T>(effect: {
  read: (wg: Wordgard) => T | undefined;
  write: (value: T, wg: Wordgard) => void;
}) => void;
```

Runs inside every editor update, without re-rendering: `read` in Wordgard's read phase, then
`write` with its value in the write phase, on the same paint as the document. For what moves with
the text (markers in the margin, pagination). It can't dispatch: Wordgard throws during its
update. A `read` returning `undefined` skips its write, and when no read asks for a write, none is
scheduled, which spares Wordgard measuring again. Reads run in the order the effects were
registered.

```tsx
// A marker in the margin, level with the cursor.
export const CursorMarker = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEditorLayoutEffect({
    read: (wg) => wg.coordsAtPos(wg.state.selection.head).top - wg.dom.getBoundingClientRect().top,
    write: (top) => {
      if (ref.current) ref.current.style.top = `${top}px`;
    },
  });
  return <div ref={ref} className="cursor-marker" style={{ position: "absolute" }} />;
};
```

#### `useEditorEventCallback`

```ts
type useEditorEventCallback = <Args extends unknown[], Result>(
  callback: (wg: Wordgard, ...args: Args) => Result
) => (...args: Args) => Result;
```

A stable function calling the latest `callback` with the editor first, for event handlers. There,
`wg.state` is the latest state, dispatches not yet drawn included. See the `SaveButton` in
[Accessing the state outside the editor](#accessing-the-state-outside-the-editor).

#### `useEditorEventListener`

```ts
type useEditorEventListener = <Type extends EditorEvent>(
  type: Type,
  handler: (wg: Wordgard, event: HTMLElementEventMap[Type]) => boolean | void
) => void;
```

Listens to the editor's DOM events of `type`, before Wordgard's handlers and keymaps. Returning
`true` handles the event: Wordgard calls `preventDefault` and skips its own handling. The event
types are listed under [Limits](#limits). Key events during a composition don't come; handling
`input`, `beforeinput` or a composition event skips Wordgard's own handling of it, so leave typing
to Wordgard.

```tsx
export const EscapeToBlur = () => {
  useEditorEventListener("keydown", (wg, event) => {
    if (event.key != "Escape") return false;
    wg.contentDOM.blur();
    return true;
  });
  return null;
};
```

### Decoration hooks

From a React shape's, wrapper's, mark's or widget's component.

#### `useNodePos`

```ts
type useNodePos = () => () => number;
```

A function giving the position of what the decoration draws, to call in handlers and effects.

#### `useStopEvent`

```ts
type useStopEvent = (stopEvent: (wg: Wordgard, event: Event) => boolean) => void;
```

Asked for events in the decoration's chrome (its root and the elements around its content element,
unless the root is the content element) and in React widgets; never for those in its content. For
an event it stops, Wordgard's handlers and keymaps are skipped and the browser's default goes
ahead: for a control in the chrome, such as an input.

#### `useIgnoreMutation`

```ts
type useIgnoreMutation = (ignore: (wg: Wordgard, mutation: MutationRecord) => boolean) => void;
```

Wordgard doesn't read the DOM mutations `ignore` returns `true` for, typing aside (Wordgard takes
it from `beforeinput`). Mutations in chrome and React widgets never reach Wordgard anyway.

#### `useIsNodeSelected`

```ts
type useIsNodeSelected = () => boolean;
```

Whether the node the decoration draws is the editor's node selection.

#### `useSelectNode`

```ts
type useSelectNode = (
  selectNode: (wg: Wordgard) => void,
  deselectNode?: (wg: Wordgard) => void
) => void;
```

Calls `selectNode` when the node becomes the node selection, and `deselectNode` when it stops being
it, once the editor's DOM is up to date (as `useEditorEffect`).

#### `useMergedDOMRefs`

```ts
type useMergedDOMRefs = <Value>(...refs: (Ref<Value> | undefined)[]) => RefCallback<Value>;
```

One ref setting several, as for a root that's also the content element (`ref` and
`contentDOMRef`).

### Props types

#### `ShapeComponentProps`

```ts
type ShapeComponentProps<E extends Element = HTMLElement> = AllHTMLAttributes<HTMLElement> & {
  nodeProps: {
    node: Node;
    getPos: () => number;
    contentDOMRef: RefCallback<Element>;
  };
  children: ReactNode;
} & RefAttributes<E>;
```

A React shape's props: `nodeProps`, the content as `children`, and Wordgard's attributes and `ref`
for its root. The content goes in the `contentDOMRef` element, else in the root; in an atom,
`children` is empty and a `contentDOMRef` throws. With `<DecorationRoot>` as the root, the
attributes and `ref` are taken care of; a root drawn by hand spreads them onto itself (see
[A root drawn by hand](#a-root-drawn-by-hand)).

#### `WrapperComponentProps`

```ts
type WrapperComponentProps<E extends Element = HTMLElement> = AllHTMLAttributes<HTMLElement> & {
  nodeProps: {
    node: Node;
    getPos: () => number;
  };
  children: ReactNode;
} & RefAttributes<E>;
```

A React wrapper's props: as a shape's, without `contentDOMRef`. `children` is what it wraps.

#### `MarkComponentProps`

```ts
type MarkComponentProps<E extends Element = HTMLElement> = AllHTMLAttributes<HTMLElement> & {
  markProps: {
    mark: Mark;
    getPos: () => number;
    contentDOMRef: RefCallback<Element>;
  };
  children: ReactNode;
} & RefAttributes<E>;
```

A React mark's props, for each run of an equal mark: `markProps.mark` is the document's mark.

#### `WidgetComponentProps`

```ts
type WidgetComponentProps<Param, E extends Element = HTMLElement> = Omit<
  AllHTMLAttributes<HTMLElement>,
  "value"
> & { value: Param } & RefAttributes<E>;
```

A React widget's props: its `value`, and, for a widget drawing a node, the node's attributes for
its root.

Also exported: `DecorationRootProps`, `ReactShape`, `WrapperOptions`, `MarkShapeOptions`,
`WidgetTypeSpec` and `EditorLayoutEffect`, the types used above.

## Migrating from react-prosemirror

react-wordgard isn't a compatibility layer: it follows Wordgard's API, and most of a migration is
moving from ProseMirror's concepts to Wordgard's (see Wordgard's
[ProseMirror migration guide](https://wordgard.net/docs/prosemirror/)). The biggest change: there
are no node views. A node is drawn by decorations, its shape and wrappers, and a React component
becomes one with `createShape` or `createWrapper`. What changes on the React side:

| react-prosemirror                                 | react-wordgard                                                                                                                                                                                                                |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<ProseMirror state={…} dispatchTransaction={…}>` | `<WordgardEditor doc={…} config={…}>`, uncontrolled: the editor owns its state, changes go through `wg.dispatch`                                                                                                              |
| `<ProseMirrorDoc />`                              | `<WordgardDoc />`                                                                                                                                                                                                             |
| `plugins` prop                                    | Wordgard extensions in `config`; to change them later, compartments or `GardState.appendConfig`                                                                                                                               |
| `nodeViews` prop and node view components         | **decorations**: no node views; a node's React component is a tag decoration, `Decoration.Tag.shape(NodeType, createShape(component))`, plus `Decoration.Tag.wrapper(NodeType, createWrapper(component))` for React around it |
| `markViews` prop and mark view components         | `createMarkShape` with `Decoration.Mark.shape`                                                                                                                                                                                |
| `widget()` decorations with a component           | `Decoration.Point.widget(MyReactWidget.of(value))`                                                                                                                                                                            |
| `getPos` prop, `useNodePos`                       | `nodeProps.getPos`, `useNodePos()` (a function, not the position)                                                                                                                                                             |
| `useStopEvent`                                    | the same name, for events in a React decoration's chrome, on its own elements or in a React widget, not in its content                                                                                                        |
| `useIgnoreMutation`                               | the same name; chrome's and React widgets' mutations never reach Wordgard anyway                                                                                                                                              |
| `useEditorState`, `useEditorStateSelector`        | the same names, with the state of the last flush                                                                                                                                                                              |
| `useEditorEffect`                                 | the same name: runs after the editor's update; what it sets shows a frame later (below)                                                                                                                                       |
| `useIsNodeSelected`, `useSelectNode`              | the same names                                                                                                                                                                                                                |
| `useMergedDOMRefs`                                | the same name                                                                                                                                                                                                                 |
| `useEditorEventCallback`                          | the same name, getting the editor                                                                                                                                                                                             |
| `useEditorEventListener`                          | the same name, before Wordgard's handlers and keymaps, for a fixed set of event types                                                                                                                                         |
| `useLayoutGroupEffect`                            | `useEditorEffect`; `useEditorLayoutEffect` to measure, then write on the same paint                                                                                                                                           |
| `reactKeys()` plugin                              | not needed: keys come from the changes Wordgard gives the view                                                                                                                                                                |

Not offered: `useIsComposingIn`, `useIsEditorStatic`.

### Migrating a node view

A react-prosemirror node view keeps its body: the props keep their names (`nodeProps`,
`contentDOMRef`, `children`, `ref`, the attributes). A paragraph that deletes the selection when
clicked, in react-prosemirror:

```tsx
function Paragraph({ children, nodeProps, ref, ...props }) {
  const onClick = useEditorEventCallback((view) => view.dispatch(view.state.tr.deleteSelection()));

  return (
    <p {...props} ref={useMergedDOMRefs(ref, nodeProps.contentDOMRef)} onClick={onClick}>
      {children}
    </p>
  );
}

const nodeViews = { paragraph: Paragraph };
```

In react-wordgard:

```tsx
import { deleteSelection } from "wordgard/command";
import { Decoration } from "wordgard/editor";
import { Paragraph } from "wordgard/types";
import { DecorationRoot, createShape, useEditorEventCallback } from "@stesura/react-wordgard";

const ParagraphShape = createShape(function ParagraphShape({ children }) {
  const onClick = useEditorEventCallback((wg) => {
    const spec = deleteSelection(wg.state);
    if (spec) wg.dispatch(spec);
  });

  return <DecorationRoot onClick={onClick}>{children}</DecorationRoot>;
});

const config = [Decoration.Tag.shape(Paragraph, ParagraphShape)];
```

What changes:

- The props type: `ShapeComponentProps` (any node, atoms included), `WrapperComponentProps`,
  `MarkComponentProps`.
- The root's tag isn't the component's choice: it's the node type's own element, what `toDOM`'s
  outer element was (see
  [Should I use a shape, a wrapper or both?](#should-i-use-a-shape-a-wrapper-or-both) for why).
- The root element, with its `{...props}` and `ref`, becomes `<DecorationRoot>`. Without a
  `contentDOMRef`, the content goes in it, so `useMergedDOMRefs` isn't needed.
- `node.attrs` becomes the node's parameter (`node.tag.param`, `node.param` for a leaf) for what
  identifies it, and marks on its tag (`node.tag.mark(Type)`) for data changed in place. `view`
  becomes `wg`, Wordgard's editor.
- Registration: `Decoration.Tag.shape(NodeType, createShape(component))` in the editor's `config`
  instead of `nodeViews`.
- Class names: `ProseMirror-selectednode` is `wg-selected-node`, a selected cell's class
  `wg-selected-cell`.
- `useNodePos()` returns a function giving the position, not the position.
- `innerDecorations` has no equivalent.

### Effects and timing

In react-prosemirror, React drives: `useEditorEffect` is a React layout effect that runs after the
view's update, inside React's commit, so it can read layout, dispatch, and what it sets shows on the
same paint. In react-wordgard, Wordgard drives: React commits inside Wordgard's update, and those
properties split between two hooks.

In practice, React's own effects (`useLayoutEffect`, `useEffect`) can run inside Wordgard's update,
before Wordgard has caught up with the new DOM: reading layout there (`coordsAtPos`) throws ("ReactWordgard
can't update while React renders or commits"), and so does dispatching ("Cannot dispatch new
updates during the editor flush phase"). Use the editor
hooks instead. `useEditorEffect` runs after the update, so it can dispatch, but what it writes to
the DOM shows a frame late: a tooltip placed there trails the cursor. `useEditorLayoutEffect`
writes on the same paint, but can't dispatch. When porting, a react-prosemirror `useEditorEffect`
that positions something becomes `useEditorLayoutEffect`; one that dispatches or focuses stays
`useEditorEffect`.

|                                           | react-prosemirror `useEditorEffect` | `useEditorEffect`                  | `useEditorLayoutEffect`                              |
| ----------------------------------------- | ----------------------------------- | ---------------------------------- | ---------------------------------------------------- |
| Reads layout after the update             | yes                                 | yes                                | yes, in Wordgard's read phase                        |
| May dispatch                              | yes                                 | yes                                | no                                                   |
| What it sets shows on the same paint      | yes                                 | no, a frame later                  | yes                                                  |
| Runs on every update without re-rendering | no                                  | no                                 | yes                                                  |
| For                                       | everything                          | menus, focus, follow-up dispatches | what moves with the text: margin markers, pagination |

## AI coding agents

The package ships a skill for building editors with react-wordgard: `skills/react-wordgard/` (in
`node_modules/@stesura/react-wordgard/`). Copy that folder into your project's `.claude/skills/`,
or point your agent to its `SKILL.md`.

## Licence

MIT, © 2026 Edoardo Caratti, see [LICENSE.txt](LICENSE.txt).

Includes code from react-prosemirror (© Handle with Care Collective and The New
York Times Company) and Wordgard (© Marijn Haverbeke); their notices are in [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt).
