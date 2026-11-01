# react-wordgard

> **Work in progress.** The API below may still change.

A React view for [Wordgard](https://www.npmjs.com/package/wordgard): React draws Wordgard's
document, inside Wordgard's own update, and Wordgard keeps doing what it does (input, selection,
composition, decorations). The API is Wordgard's; react-wordgard adds what React needs to draw it.

This repository is derived from
[react-prosemirror](https://github.com/handlewithcarecollective/react-prosemirror),
by [Handle with Care Collective](https://github.com/handlewithcarecollective)
and originally The New York Times Company. Thanks to them for the design this
builds on.

`src/prosemirror/` still holds the ProseMirror view of our react-prosemirror fork, for the
ProseMirror demo and as the benchmark's comparison, until it's deleted. Its changes for large
documents, against upstream:

- Node, mark, text and widget views place their view description among their
  siblings with a binary search instead of re-sorting the sibling list.
- The `reactKeys` plugin keeps its key tables for transactions that only change
  attributes or node marks.
- `<ProseMirror>` takes an opt-in `stableContexts` prop.
- A node view's first render decides `contentEditable` from the schema.
- `ReactEditorView` detaches the React-rendered children around the base
  constructor's attribute changes.

## Usage

```tsx
import { forwardRef } from "react";
import { Decoration } from "wordgard/editor";
import { basicSchema, image } from "wordgard/schema";
import { Image } from "wordgard/types";
import { WordgardDoc, WordgardEditor, reactWidget, useEditorStateSelector } from "react-wordgard";

// An image drawn by a React component. It forwards its ref to its root element,
// which becomes the widget's DOM; `render` is what plain Wordgard draws.
const ImageView = forwardRef<HTMLImageElement, { value: string }>(({ value }, ref) => (
  <img ref={ref} src={value} />
));
const ReactImage = reactWidget({
  render: (src) => Object.assign(document.createElement("img"), { src }),
  component: ImageView,
});

const WordCount = () => {
  const words = useEditorStateSelector((state) => state.doc.textContent().split(/\s+/).length);
  return <output>{words} words</output>;
};

export const Editor = () => (
  <WordgardEditor
    doc="<p>Hello <strong>world</strong></p>"
    config={[
      basicSchema(),
      image(),
      Decoration.Tag.shape(Image, (tag) => ReactImage.of(tag.param)),
    ]}
  >
    <WordCount />
    <WordgardDoc className="editor" />
  </WordgardEditor>
);
```

- `<WordgardEditor>` creates the editor from a `Wordgard.Spec` (read once: the editor owns its
  state; change it with `dispatch`, and its configuration with Wordgard's compartments) and
  provides it to what it holds. `<WordgardDoc>` puts the editor in the page and renders the
  document through a portal, in your React tree: your contexts reach React widgets. One
  `<WordgardDoc>` per editor; a second one throws.
- `reactWidget(spec)` takes `Widget.define`'s spec plus a `component`. It's a real
  `Widget.Type`: use it wherever Wordgard takes a widget (a node's shape, a tag or point widget,
  inside an `Elt` shape). React widgets are uneditable by default, so a component may re-render
  on its own; it must keep the same root element.
- Hooks, from inside `<WordgardEditor>` or a React widget:
  - `useWordgard()`: the editor.
  - `useEditorState()`, `useEditorStateSelector(selector, isEqual?)`: the state as of the
    editor's last flush, rendered in the same React commit as the document. The selector's result
    re-renders when it changes, by `Object.is` or by `isEqual`.
  - `useEditorEffect(effect, deps)`: an effect run once the editor's DOM is up to date, where it
    may read layout (`coordsAtPos`) and dispatch.
  - `useEditorEventCallback(callback)`: a stable callback getting the editor.
  - `useEditorMeasure({ read, write })`: reads in every update's read phase, writes in its write
    phase, on the same paint as the document.
  - `useWidgetPos()`, in a React widget: a function returning its position.
- In React's StrictMode (development only), `<WordgardEditor>` creates its editor twice and
  drops one, which is never put in the page.
- Don't read the editor's layout from a plain React effect: it runs inside Wordgard's update,
  before the editor's view of the new DOM exists. Use `useEditorEffect` or `useEditorMeasure`.

## Migrating from react-prosemirror

react-wordgard isn't a compatibility layer: it follows Wordgard's API, and most of a migration is
moving from ProseMirror's concepts to Wordgard's (see Wordgard's
[ProseMirror migration guide](https://wordgard.net/docs/prosemirror/)). What changes on the React
side:

| react-prosemirror                                 | react-wordgard                                                                                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<ProseMirror state={…} dispatchTransaction={…}>` | `<WordgardEditor doc={…} config={…}>`, uncontrolled: the editor owns its state, changes go through `wg.dispatch`                                                    |
| `<ProseMirrorDoc />`                              | `<WordgardDoc />`                                                                                                                                                   |
| `plugins` prop                                    | Wordgard extensions in `config`; to change them later, compartments or `GardState.appendConfig`                                                                     |
| `nodeViews` prop and node view components         | Tag decorations (`Decoration.Tag.shape`, `.widget`, `.wrapper`, `.attribute`): an `Elt` shape for structure and editable content, React widgets for what needs code |
| `widget()` decorations with a component           | `Decoration.Point.widget(MyReactWidget.of(value))`                                                                                                                  |
| `getPos` prop, `useNodePos`                       | `useWidgetPos()`                                                                                                                                                    |
| `useStopEvent`                                    | the widget spec's `propagateEvent`                                                                                                                                  |
| `useIgnoreMutation`                               | not needed: React widgets are uneditable, Wordgard ignores their mutations                                                                                          |
| `useEditorState`, `useEditorStateSelector`        | the same names, with the state of the last flush                                                                                                                    |
| `useEditorEffect`                                 | the same name: runs after the editor's update                                                                                                                       |
| `useEditorEventCallback`                          | the same name, getting the editor                                                                                                                                   |
| `useEditorEventListener`                          | `Wordgard.domEventHandler` in `config`                                                                                                                              |
| `useLayoutGroupEffect`                            | `useEditorEffect`; `useEditorMeasure` to measure, then write on the same paint                                                                                      |
| `reactKeys()` plugin                              | not needed: keys come from the changes Wordgard gives the view                                                                                                      |

Not offered yet: whether a node is selected (`useIsNodeSelected`, `useSelectNode`), composition
state (`useIsComposingIn`) and focus state.

## Development

Needs Node 22.12 or later.

```sh
npm install
npx playwright install chromium firefox webkit  # once, for the browser tests
npm run build
npm run check                                   # types, lint, format
npm test                                        # unit (jsdom) and browser (Chromium, Firefox, WebKit) tests
npm run demo                                    # the demo, on Vite's dev server
npm run bench                                   # times ReactWordgard, Wordgard, react-prosemirror and ProseMirror
npm run bench:heap                              # what each editor holds in the heap, by class
npm run bench:profile                           # where load's and a keystroke's time go, by function
```

The benchmark (`bench/`, not part of the package) times load, a keystroke and bolding the whole
document, and measures the memory each loaded editor holds, at 2,500 and 15,000 paragraphs. It uses
React's production build; `npm run bench:dev` uses the development build and `npm run bench:smoke`
checks it runs; `npm run bench:heap` breaks the memory down by class, from heap snapshots. Run it
on an idle machine, on mains power. An editor holding over 1 GB skips the
whole-document format: Chromium caps a page's heap at 4 GB, and react-prosemirror runs out of it
there at 15,000 paragraphs with inline nodes.

## Licence

MIT, © 2026 Edoardo Caratti, see [LICENSE.txt](LICENSE.txt).

Includes code from react-prosemirror (© Handle with Care Collective and The New
York Times Company) and ProseMirror (© Marijn Haverbeke and others); their
notices are in [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt).
