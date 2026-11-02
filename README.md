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
import { Wordgard } from "wordgard/editor";
import { basicSchema, image } from "wordgard/schema";
import { Image } from "wordgard/types";
import {
  type WidgetComponentProps,
  WordgardDoc,
  WordgardEditor,
  createWidgetType,
  useEditorStateSelector,
} from "react-wordgard";

// An image drawn by a React component. Its root element gets the ref, which makes it the
// widget's DOM, and the node's attributes: the image's `alt`, the selected node's class.
function ImageWidget({ value, ref, ...attrs }: WidgetComponentProps<string, HTMLImageElement>) {
  return <img {...attrs} ref={ref} src={value} />;
}
const ReactImage = createWidgetType({ component: ImageWidget });

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
        ReactImage.shape(Image),
        Wordgard.contentAttributes.of({ "aria-label": "Document" }),
      ]}
    >
      <WordCount />
      <WordgardDoc className="editor" />
    </WordgardEditor>
  );
}
```

React 19 passes `ref` as a prop, as above. On React 18, wrap the component in `forwardRef`; the
same goes for shapes, wrappers and marks:

```tsx
import { forwardRef } from "react";

const ImageWidget = forwardRef<HTMLImageElement, WidgetComponentProps<string, HTMLImageElement>>(
  function ImageWidget({ value, ...attrs }, ref) {
    return <img {...attrs} ref={ref} src={value} />;
  }
);
```

- `<WordgardEditor>` creates the editor from a `Wordgard.Spec` and provides it to what it holds.
  The spec is read once, when it mounts: changing `doc` or `config` afterwards does nothing. The
  editor owns its state: change it with `dispatch`, and its configuration with Wordgard's
  compartments or `GardState.appendConfig`. `<WordgardDoc>` puts the editor in the page and
  renders the document through a portal, in your React tree: your contexts reach React widgets.
  One `<WordgardDoc>` per editor; a second one throws.
- `createWidgetType(spec)` takes `Widget.define`'s spec, `component` in place of `render`
  (`eq`, `editable`, `inFlow`, `propagateEvent`, `connect`, `disconnect` keep their meaning), and
  returns a real `Widget.Type`, as `Widget.define` does: call it once, at module level, and use
  its widgets (`type.of(value)`) wherever Wordgard takes a widget (a node's shape, a tag or point
  widget, inside an `Elt` shape). `type.shape(nodeType, value?)` draws a node type as the widget,
  its value the node's parameter or `value(tag)`: short for
  `Decoration.Tag.shape(nodeType, (tag) => type.of(value ? value(tag) : tag.param))`. React
  widgets are uneditable by default, so a component may re-render on its own; it must keep the
  same root element. A widget drawing a node gets the node's attributes as props (`className` for
  the selected node, tag and mark attributes), for its root.
- Spread the attributes a component gets onto its root. Wordgard has already merged the
  decorations' attributes into one `className` and one `style`; a component setting its own
  merges them with those (joins the classes, spreads the style), or one replaces the other.
- React shapes, wrappers and marks: below.
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
    margin, pagination). It can't dispatch: Wordgard throws during its update.
  - `useEditorEventListener(type, (wg, event) => handled)`: the editor's DOM events of `type`
    before Wordgard's handlers and keymaps; returning true handles the event. Key events during
    a composition don't come; handling `input`, `beforeinput` or composition events skips
    Wordgard's own handling of them.
- Hooks, from inside a React shape, wrapper, mark or widget:
  - `useNodePos()`: a function returning the position of what it draws.
  - `useStopEvent((wg, event) => stop)`: Wordgard leaves alone the events it stops, in the
    decoration's chrome or in a React widget (not on its own elements or in plain content).
  - `useIgnoreMutation((wg, record) => ignore)`: Wordgard doesn't read the DOM mutations it
    claims, typing aside (Wordgard takes it from `beforeinput`).
  - `useIsNodeSelected()`, `useSelectNode(select, deselect?)`: the node selection.
  - `useMergedDOMRefs(...refs)`: one ref setting several, as for a root that's also the content
    element.
- In React's StrictMode (development only), `<WordgardEditor>` creates its editor twice and
  drops one, which is never put in the page.
- Don't read the editor's layout from a plain React effect: it runs inside Wordgard's update,
  before the editor's view of the new DOM exists. Use `useEditorEffect` or `useEditorLayoutEffect`.

### React shapes, wrappers and marks

A node's shape, a wrapper and a mark's shape can each be a React component that renders what it
holds as `children`, and changes the DOM around it (its "chrome") on its own: from its state, a
context or a store. `createShape`, `createWrapper` and `createMarkShape` are functions you call once,
at module level, with the component: each returns the Wordgard value its name says (a shape, a
wrapper, a mark's shape), what plain Wordgard draws, registered as drawn by the component. You pass
it to Wordgard's decorations:

```tsx
import { Decoration } from "wordgard/editor";
import { Blockquote, Link } from "wordgard/types";
import {
  type MarkComponentProps,
  type ShapeComponentProps,
  createMarkShape,
  createShape,
} from "react-wordgard";

// A blockquote drawn as a callout: a decorative icon, then the content.
function Callout({ nodeProps: { contentDOMRef }, children, ref, ...attrs }: ShapeComponentProps) {
  return (
    <aside {...attrs} ref={ref}>
      <span aria-hidden="true">💡</span>
      <div className="body" ref={contentDOMRef}>
        {children}
      </div>
    </aside>
  );
}

// A link, its target the mark's value.
function LinkMark({
  markProps: { mark, contentDOMRef },
  children,
  ref,
  ...attrs
}: MarkComponentProps<HTMLAnchorElement>) {
  return (
    <a {...attrs} ref={ref} href={String(mark.value)}>
      <span ref={contentDOMRef}>{children}</span>
    </a>
  );
}

const config = [
  Decoration.Tag.shape(Blockquote, createShape({ component: Callout, element: "aside" })),
  Decoration.Mark.shape(Link, createMarkShape({ component: LinkMark, element: "a" })),
];
```

- `createShape({ component, element })`, for `Decoration.Tag.shape` and `Decoration.Point.shape`:
  the component gets `nodeProps` (`node`, `getPos`, `contentDOMRef`), `children` (the content), a
  `ref` for its root, and the decorations' attributes as props. The content goes in the
  `contentDOMRef` element, else in the root. For nodes with content; a leaf is a React widget.
- `createWrapper({ component, element })`, for `Decoration.Tag.wrapper` and
  `Decoration.Point.wrapper`: the same props without `contentDOMRef`; `children` is what it
  wraps (the node's shape, or the element its `target` picks).
- `createMarkShape({ component, element })`, for `Decoration.Mark.shape` or a mark type's own `shape`:
  `markProps` (`mark`, the document's, `getPos`, `contentDOMRef`), `children`, `ref`. One
  component draws each run of an equal mark. A React mark replacing an attribute-shaped mark makes
  it element-shaped.
- `element` is the component's root element (`div` for shapes and wrappers, `span` for marks, by
  default; `span` for an inline node): `target` selectors match it, and plain Wordgard draws it.
- Spread the attributes onto the root: they carry Wordgard's selection classes
  (`wg-selected-node`, `wg-selected-cell`), tag, point and mark attributes. The chrome is made
  uneditable unless it sets `contentEditable` itself.

### Accessibility

- Wordgard gives the editable element `role="textbox"` and `aria-multiline`. Name it with
  `Wordgard.contentAttributes.of({ "aria-label": "…" })`: in Wordgard 0.6.2, `Wordgard.label`
  puts the label on the editor's outer element, which leaves the textbox without a name.
- A React decoration's chrome is read inline, with the document's text. Hide what's decorative
  (`aria-hidden` on icons and counters), and give every control a name (its text or
  `aria-label`).
- Chrome is uneditable: a control in it needs to be focusable to be reached by keyboard, and
  `useStopEvent` for its events, so that Wordgard leaves its keys alone.
- A React widget drawing a node gets the node's attributes as props, an image's `alt` among them:
  spread them onto the root.
- The tests run axe-core over editors with React shapes, marks and widgets
  (`src/__tests__/accessibility.browser.test.tsx`): nothing breaks a rule plain Wordgard keeps.

### Limits

- A React decoration must keep its root element. Moving `{children}` under another element
  remounts the content: the browser loses a selection or an IME composition in it.
- In a textblock or a mark, the content element holds only the content: chrome there would be text
  that can't be told from the content's. In a node holding blocks, chrome may sit before or after
  the content in the same element, not between its nodes.
- A React wrapper can't wrap a node a native widget draws (draw it with a React widget), nor text.
- `useStopEvent` is asked for events in chrome and in React widgets, not on a decoration's own
  elements or in plain content.
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

| react-prosemirror                                 | react-wordgard                                                                                                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<ProseMirror state={…} dispatchTransaction={…}>` | `<WordgardEditor doc={…} config={…}>`, uncontrolled: the editor owns its state, changes go through `wg.dispatch`                                              |
| `<ProseMirrorDoc />`                              | `<WordgardDoc />`                                                                                                                                             |
| `plugins` prop                                    | Wordgard extensions in `config`; to change them later, compartments or `GardState.appendConfig`                                                               |
| `nodeViews` prop and node view components         | Tag decorations: `createShape` with `Decoration.Tag.shape` for a node with content, a React widget for an atom, `createWrapper` with `Decoration.Tag.wrapper` |
| `markViews` prop and mark view components         | `createMarkShape` with `Decoration.Mark.shape`                                                                                                                |
| `widget()` decorations with a component           | `Decoration.Point.widget(MyReactWidget.of(value))`                                                                                                            |
| `getPos` prop, `useNodePos`                       | `nodeProps.getPos`, `useNodePos()` (a function, not the position)                                                                                             |
| `useStopEvent`                                    | the same name, for events in a React decoration's chrome or a React widget                                                                                    |
| `useIgnoreMutation`                               | the same name; chrome's and React widgets' mutations never reach Wordgard anyway                                                                              |
| `useEditorState`, `useEditorStateSelector`        | the same names, with the state of the last flush                                                                                                              |
| `useEditorEffect`                                 | the same name: runs after the editor's update; what it sets shows a frame later (below)                                                                       |
| `useIsNodeSelected`, `useSelectNode`              | the same names                                                                                                                                                |
| `useMergedDOMRefs`                                | the same name                                                                                                                                                 |
| `useEditorEventCallback`                          | the same name, getting the editor                                                                                                                             |
| `useEditorEventListener`                          | the same name, before Wordgard's handlers and keymaps, for a fixed set of event types                                                                         |
| `useLayoutGroupEffect`                            | `useEditorEffect`; `useEditorLayoutEffect` to measure, then write on the same paint                                                                           |
| `reactKeys()` plugin                              | not needed: keys come from the changes Wordgard gives the view                                                                                                |

Not offered: `useIsComposingIn`, `useIsEditorStatic`.

### Migrating a node view

A react-prosemirror node view keeps its body: the props keep their names (`nodeProps`,
`contentDOMRef`, `children`, `ref`, the attributes). What changes:

- The props type: `ShapeComponentProps` (a node with content), `WrapperComponentProps`,
  `MarkComponentProps`, or a React widget's `WidgetComponentProps` for an atom.
- `node.attrs` becomes the node's parameter (`node.tag.param` for a node with content, `node.param`
  for a leaf), and `view` becomes `wg`, Wordgard's editor.
- Registration: a decoration in the editor's `config` instead of `nodeViews`.
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
